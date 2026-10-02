import { defaultExecutorFileLimit } from '#src/common/constants/defaultExecutorFileLimit.ts';
import { defaultPackagesDir } from '#src/common/constants/defaultPackagesDir.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';
import type { DecisionsRecord } from '#src/contracts/plan/decisions/DecisionsRecord.ts';
import { FindingSeverity } from '#src/contracts/plan/grade/FindingSeverity.ts';
import { StructuralCheck } from '#src/contracts/plan/grade/StructuralCheck.ts';
import type { StructuralFinding } from '#src/contracts/plan/grade/StructuralFinding.ts';
import type { PhaseFile } from '#src/plan/common/types/PhaseFile.ts';
import { buildPlanSyncDecisionsCommand } from '#src/plan/decisionLog/buildPlanSyncDecisionsCommand.ts';
import { PlanFileKind } from '#src/plan/internal/common/constants/PlanFileKind.ts';
import { readRepoPathIndex } from '#src/plan/internal/common/paths/readRepoPathIndex.ts';
import type { PhaseSizeCounts } from '#src/plan/internal/common/types/PhaseSizeCounts.ts';
import { getPhaseProvenance } from '#src/plan/internal/common/utils/getPhaseProvenance.ts';
import { getPlanNamedPaths } from '#src/plan/internal/common/utils/getPlanNamedPaths.ts';
import { getPlanTouchedPaths } from '#src/plan/internal/common/utils/getPlanTouchedPaths.ts';
import { checkAcceptanceLedger } from '#src/plan/lint/checkAcceptanceLedger.ts';
import { checkDecisionLog } from '#src/plan/lint/checkDecisionLog.ts';
import { checkGlobalConstraints } from '#src/plan/lint/checkGlobalConstraints.ts';
import { checkHandoffDeclared } from '#src/plan/lint/checkHandoffDeclared.ts';
import { checkPlanPaths } from '#src/plan/lint/checkPlanPaths.ts';
import { checkPlanSizes } from '#src/plan/lint/checkPlanSizes.ts';
import { checkProsePaths } from '#src/plan/lint/checkProsePaths.ts';
import { checkVerificationScripts } from '#src/plan/lint/checkVerificationScripts.ts';
import { checkBuildMode } from '#src/plan/lint/internal/checkBuildMode.ts';
import { checkRenames } from '#src/plan/lint/internal/checkRenames.ts';
import { isPhasedDeliverable } from '#src/plan/lint/internal/common/utils/isPhasedDeliverable.ts';
import { readPhaseFiles } from '#src/plan/lint/internal/common/utils/readPhaseFiles.ts';
import { lintPlanCrossPhase } from '#src/plan/lint/lintPlanCrossPhase.ts';
import { scanPlaceholders } from '#src/plan/lint/scanPlaceholders.ts';
import { parsePhaseDeclarations } from '#src/plan/parsePhaseDeclarations.ts';

interface Params {
	cwd: string;
	/** Absolute. */
	planPaths: string[];
	/** Required: an absent record would silently no-op the currency check. */
	decisions: DecisionsRecord;
	config?: LightsoutConfig;
}

/** `Documentation` and `Acceptance Tests` are added by a repository's own config, so neither is written here. */
const requiredSections = {
	[PlanFileKind.Implementable]: ['Prerequisites', 'Global Constraints', 'Scope Boundaries', 'Verification', 'What Next Plan Expects'],
	[PlanFileKind.Overview]: ['Phases', 'Phase Declarations', 'Cross-Phase Dependencies', 'Global Constraints'],
} as const;

const checkSections = ({ phase, docsDeclared, contract }: { phase: PhaseFile; docsDeclared: boolean; contract: boolean }) => {
	const implementable = phase.plan.variant === PlanFileKind.Implementable;

	return [
		...requiredSections[phase.plan.variant],
		...(docsDeclared && implementable ? ['Documentation'] : []),
		...(contract && implementable ? ['Acceptance Tests'] : []),
	]
		.filter((section) => !phase.plan.sections.has(section))
		.map((section) => ({
			check: StructuralCheck.SectionsPresent,
			severity: FindingSeverity.Blocking,
			phase: phase.base,
			issue: `missing required section '## ${section}' (${phase.plan.variant} plan)`,
			location: phase.base,
			fix: `add a '## ${section}' section`,
		}));
};

const checkPlaceholders = ({ phase }: { phase: PhaseFile }) =>
	scanPlaceholders({ lines: phase.plan.lines, skipRange: phase.plan.decisionLogRange }).map(({ label, line }) => ({
		check: StructuralCheck.NoPlaceholders,
		severity: FindingSeverity.Blocking,
		phase: phase.base,
		issue: `unresolved placeholder '${label}' present`,
		location: `${phase.base}:${line}`,
		fix: `resolve '${label}' — every open question must be decided before the plan is written`,
	}));

const checkMoves = ({ phase }: { phase: PhaseFile }) =>
	phase.plan.malformedMoveLines.map((line) => ({
		check: StructuralCheck.MoveWellFormed,
		severity: FindingSeverity.Blocking,
		phase: phase.base,
		issue: 'a Files to Move heading does not name two paths',
		location: `${phase.base}:${line}`,
		fix: 'write the heading as an old path and a new path, each in backticks',
	}));

/**
 * A phase may verify with a script only the plan creates, and the overview,
 * standing for the whole deliverable, sees the union.
 */
const getDeclaredScripts = ({ overview, phases }: { overview?: PhaseFile; phases: PhaseFile[] }) => {
	const byPhase = new Map<string, Set<string>>();

	if (!overview) {
		return byPhase;
	}

	const declarations = parsePhaseDeclarations({ plan: overview.plan });
	const running = new Set<string>();

	for (const phase of phases) {
		for (const script of declarations.find((declaration) => declaration.file === phase.base)?.scripts ?? []) {
			running.add(script);
		}

		byPhase.set(phase.base, new Set(running));
	}

	byPhase.set(overview.base, new Set(declarations.flatMap((declaration) => declaration.scripts)));

	return byPhase;
};

const isCleared = ({ finding, clearedCreates }: { finding: StructuralFinding; clearedCreates: Set<string> }) =>
	finding.check === StructuralCheck.PathExists && clearedCreates.has(`${finding.phase}|${finding.location.split(' → ').at(-1)}`);

const checkPackages = ({ phase, packagesDir }: { phase: PhaseFile; packagesDir: string }) =>
	getPlanNamedPaths({ plan: phase.plan })
		.filter((path) => path.startsWith(`${packagesDir}/`) && !path.slice(packagesDir.length + 1).includes('/'))
		.map((path) => ({
			check: StructuralCheck.PackagesIdentifiable,
			severity: FindingSeverity.Blocking,
			phase: phase.base,
			issue: `path '${path}' is directly under ${packagesDir}/ with no package segment`,
			location: `${phase.base} → ${path}`,
			fix: `place the file under ${packagesDir}/<package>/…`,
		}));

/**
 * Provenance is resolved before the per-file checks run, so each knows which
 * paths a strictly earlier phase supplies. The cross-phase pass may then drop a
 * `path-exists` finding, because delete-then-recreate is legitimate work the
 * per-file check cannot recognise.
 */
export const lintPlanStructure = async ({ cwd, planPaths, decisions, config }: Params): Promise<StructuralFinding[]> => {
	const packagesDir = config?.['packages-dir'] ?? defaultPackagesDir;
	const fileLimit = config?.['executor-file-limit'] ?? defaultExecutorFileLimit;
	const docsDeclared = (config?.docs?.length ?? 0) > 0;
	const contract = config?.plan?.contract === true;
	const gateKeys = new Set(Object.keys(config?.gates ?? {}));
	const configCommands = new Set(Object.values(config?.gates ?? {}).filter((value): value is string => typeof value === 'string'));
	const { phases, findings } = await readPhaseFiles({ planPaths });
	const overview = phases.find((file) => file.plan.variant === PlanFileKind.Overview);
	const implementable = phases.filter((file) => file.plan.variant !== PlanFileKind.Overview).sort((one, other) => one.number - other.number);
	const phased = isPhasedDeliverable({ hasOverview: overview !== undefined, implementableCount: implementable.length });
	const provenance = getPhaseProvenance({ phases: implementable });
	const declaredByPhase = getDeclaredScripts({ overview, phases: implementable });
	// Read once per lint run, or a phased plan would walk the repo once per file.
	const repoIndex = await readRepoPathIndex({ cwd });
	const syncCommand = buildPlanSyncDecisionsCommand({ cwd, name: decisions.planName }).command;
	const planned = new Set(provenance.createdBy.keys());
	const counts = new Map<string, PhaseSizeCounts>();

	for (const phase of overview ? [overview, ...implementable] : implementable) {
		const provided = provenance.providedBefore.get(phase.base) ?? new Set<string>();
		const declaredScripts = declaredByPhase.get(phase.base) ?? new Set<string>();
		const shared = { plan: phase.plan, cwd, planPath: phase.path, phase: phase.base };
		const { created, touched } = getPlanTouchedPaths({ plan: phase.plan });
		const sizes = { created: created.length, touched: touched.length };

		counts.set(phase.base, sizes);

		findings.push(
			...checkSections({ phase, docsDeclared, contract }),
			...(await checkPlanPaths({ ...shared, provided, phased })),
			...(await checkProsePaths({ ...shared, planned, index: repoIndex })),
			...(await checkVerificationScripts({ ...shared, packagesDir, configCommands, declaredScripts })),
			...(phase.plan.variant === PlanFileKind.Implementable
				? [
						...(await checkAcceptanceLedger({ plan: phase.plan, cwd, phase: phase.base, required: contract, gateKeys })),
						...checkRenames({ plan: phase.plan, phase: phase.base }),
						...checkBuildMode({ plan: phase.plan, phase: phase.base }),
					]
				: []),
			...checkDecisionLog({ plan: phase.plan, phase: phase.base, decisions, phased, syncCommand }),
			...checkGlobalConstraints({ plan: phase.plan, phase: phase.base, decisions, syncCommand }),
			...checkHandoffDeclared({ plan: phase.plan, phase: phase.base }),
			...checkPlaceholders({ phase }),
			...checkMoves({ phase }),
			...checkPlanSizes({ phase, fileLimit, counts: sizes }),
			...checkPackages({ phase, packagesDir }),
		);
	}

	const crossPhase = await lintPlanCrossPhase({ cwd, overview, phases: implementable, provenance, counts });

	return [...findings.filter((finding) => !isCleared({ finding, clearedCreates: crossPhase.clearedCreates })), ...crossPhase.findings];
};
