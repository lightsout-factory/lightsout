import { extractRunScriptName } from '#src/common/config/extractRunScriptName.ts';
import { resolvePackageGatesConfig } from '#src/common/config/resolvePackageGatesConfig.ts';
import { messageOf } from '#src/common/utils/messageOf.ts';
import { readPackageManifest } from '#src/common/workspace/readPackageManifest.ts';
import type { GateResult } from '#src/contracts/gates/GateResult.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';
import { GateScheduleKind } from '#src/gates/common/constants/GateScheduleKind.ts';
import type { GateRunResult } from '#src/gates/common/types/GateRunResult.ts';
import type { GateSchedule } from '#src/gates/common/types/GateSchedule.ts';
import type { GateEntry } from '#src/gates/internal/common/types/GateEntry.ts';
import type { RunGate } from '#src/gates/internal/common/types/RunGate.ts';
import { buildGateEntries } from '#src/gates/internal/common/utils/buildGateEntries.ts';
import { buildGateStages } from '#src/gates/internal/common/utils/buildGateStages.ts';
import { runGateSet } from '#src/gates/internal/runGateSet.ts';
import { appendCommandLog } from '#src/runState/appendCommandLog.ts';

/** `undefined` when the package has no script for it and the gate was skipped with evidence. */
type ResolveTemplate = (params: { kind: string; template: string }) => Promise<string | undefined>;

/**
 * Resolution happens after selection, so a gate a held tier never scheduled
 * records no skip. Coverage replaces the plain unit suite in the default
 * schedule, so a package with no coverage script falls back to its tests.
 */
const resolveScopedEntries = async ({
	entries,
	testTemplate,
	resolveTemplate,
	coverageFallback,
}: {
	entries: GateEntry[];
	testTemplate: string;
	resolveTemplate: ResolveTemplate;
	coverageFallback: boolean;
}) => {
	const scheduledTest = entries.some((entry) => entry.name === 'test');
	const resolved: GateEntry[] = [];

	for (const entry of entries) {
		const command = await resolveTemplate({ kind: entry.family, template: entry.command });

		if (command !== undefined) {
			resolved.push({ ...entry, command });
		} else if (coverageFallback && entry.name === 'test-coverage' && !scheduledTest) {
			const fallback = await resolveTemplate({ kind: 'test', template: testTemplate });

			if (fallback !== undefined) {
				resolved.push({ family: 'test', name: 'test', command: fallback });
			}
		}
	}

	return resolved;
};

interface Params {
	cwd: string;
	packagesDir: string;
	/** Also the group label in the evidence. */
	packageDir: string;
	scoped: NonNullable<LightsoutConfig['package-gates']>;
	coverage?: boolean;
	schedule: GateSchedule;
	/** The index `runGates` is holding every group at. */
	stage: number;
	gate: RunGate;
	failFast?: boolean;
	runId?: string;
	step?: string;
	onGateResult?: (result: GateResult) => void;
	onProgress?: (message: string) => void;
}

/**
 * A scoped template fans out to every package in scope, including ones the
 * consumer never hand-tuned (infra, docs), so a package with no matching script
 * is skipped with evidence — never failed, and never silently passed. A
 * template with no `run` token always executes.
 *
 * Called once per stage because a group cannot wait for its siblings from
 * inside itself. An unresolvable package.json is the reserved
 * `package-manifest` family, so one bad package never takes down the fan-out.
 */
export const runPackageGates = async ({
	cwd,
	packagesDir,
	packageDir,
	scoped,
	coverage,
	schedule,
	stage,
	gate,
	failFast,
	runId,
	step,
	onGateResult,
	onProgress,
}: Params): Promise<GateRunResult> => {
	let manifest: Awaited<ReturnType<typeof readPackageManifest>>;

	try {
		manifest = await readPackageManifest({ cwd, packagesDir, packageDir });
	} catch (error) {
		return { error: messageOf({ error }), failedFamilies: ['package-manifest'], crashes: [], timeouts: [], coordination: undefined };
	}

	const templates = resolvePackageGatesConfig({ packageGates: scoped });
	const substitute = ({ command }: { command: string }) => command.split('{package}').join(manifest.name);

	const resolveTemplate: ResolveTemplate = async ({ kind, template }) => {
		const scriptName = extractRunScriptName({ command: template });

		if (!scriptName || Object.hasOwn(manifest.scripts, scriptName)) {
			return substitute({ command: template });
		}

		onProgress?.(`gate [${packageDir}] ${kind}: skipped (no "${scriptName}" script)`);

		if (runId) {
			await appendCommandLog({
				cwd,
				runId,
				record: {
					at: new Date().toISOString(),
					step,
					group: packageDir,
					kind,
					command: substitute({ command: template }),
					skipped: true,
					reason: `no "${scriptName}" script`,
				},
			});
		}

		onGateResult?.({ kind, group: packageDir, command: substitute({ command: template }), skipped: true, reason: `no "${scriptName}" script` });

		return undefined;
	};

	const entries = buildGateEntries({ commands: templates });
	const scheduled = buildGateStages({ entries, schedule, coverage })[stage] ?? [];

	return runGateSet({
		label: packageDir,
		gate,
		failFast,
		entries: await resolveScopedEntries({
			entries: scheduled,
			testTemplate: templates.test,
			resolveTemplate,
			coverageFallback: schedule.kind !== GateScheduleKind.Exact,
		}),
	});
};
