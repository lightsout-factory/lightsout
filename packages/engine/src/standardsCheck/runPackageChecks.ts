import { type StandardsCheckFunction, type StandardsCheckInput, StandardsInputKind } from '@lightsout/standards-contracts';
import { defaultPackagesDir } from '#src/common/constants/defaultPackagesDir.ts';
import { isTestFile } from '#src/common/sourceFiles/isTestFile.ts';
import { listSourceFiles } from '#src/common/sourceFiles/listSourceFiles.ts';
import { resolveConsumerTypescript } from '#src/common/workspace/resolveConsumerTypescript.ts';
import type { StandardsFinding } from '#src/contracts/standardsCheck/StandardsFinding.ts';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import { buildCheckInput } from '#src/standardsCheck/internal/common/checkInputs/buildCheckInput.ts';
import { typescriptInputKinds } from '#src/standardsCheck/internal/common/constants/typescriptInputKinds.ts';
import type { ResolvedRuleState } from '#src/standardsCheck/internal/common/types/ResolvedRuleState.ts';
import { findFoldersWithoutAliasSource } from '#src/standardsCheck/internal/common/utils/findFoldersWithoutAliasSource.ts';
import { runRuleCheck } from '#src/standardsCheck/internal/common/utils/runRuleCheck.ts';
import type { LoadedStandardsLibrary } from '#src/standardsLibraries/common/types/LoadedStandardsLibrary.ts';

interface LiveRule {
	id: string;
	/** The full `<library>/<rule-id>` name every finding carries. */
	name: string;
	inputKind: StandardsInputKind;
	run: StandardsCheckFunction;
	/** Only the two reporting severities — an `off` rule never becomes a live one. */
	severity: StandardsFinding['severity'];
	options: Record<string, number>;
}

/** Channel gating is all-or-nothing per document: a framework document that does not apply contributes no prose, so no checks either. */
const selectLiveRules = ({ packs, states, channels }: { packs: LoadedStandardsLibrary[]; states: Map<string, ResolvedRuleState>; channels: string[] }) => {
	const live: LiveRule[] = [];

	for (const rule of packs.flatMap((pack) => pack.rules)) {
		const state = states.get(rule.name);

		if (rule.run === undefined || rule.inputKind === undefined || state === undefined) {
			continue;
		}

		if (state.severity === StandardsSeverity.Off) {
			continue;
		}

		if (rule.channel !== 'base' && !channels.includes(rule.channel)) {
			continue;
		}

		live.push({ id: rule.id, name: rule.name, inputKind: rule.inputKind, run: rule.run, severity: state.severity, options: state.options });
	}

	return live;
};

type BuildInput = (params: { kind: StandardsInputKind; options: Record<string, number> }) => Promise<StandardsCheckInput>;

/** A kind needing TypeScript when none resolves does not fail the run: its rules are named as skipped and the rest still report. */
const runLiveRules = async ({
	live,
	buildInput,
	compiler,
	progress,
}: {
	live: LiveRule[];
	buildInput: BuildInput;
	compiler: ReturnType<typeof resolveConsumerTypescript>;
	progress: (message: string) => void;
}) => {
	const findings: StandardsFinding[] = [];
	const skipped: string[] = [];

	for (const kind of Object.values(StandardsInputKind)) {
		const rules = live.filter((rule) => rule.inputKind === kind);

		if (rules.length === 0) {
			continue;
		}

		if (compiler === undefined && typescriptInputKinds.has(kind)) {
			skipped.push(...rules.map((rule) => rule.name));
			continue;
		}

		let shared: StandardsCheckInput | undefined;

		for (const rule of rules) {
			let input: StandardsCheckInput;

			if (kind === StandardsInputKind.CloneSpans) {
				input = await buildInput({ kind, options: rule.options });
			} else {
				// Every kind but clone-spans is options-blind, so one build serves
				// every rule that asked for it.
				shared ??= await buildInput({ kind, options: rule.options });
				input = shared;
			}

			const raw = await runRuleCheck({ rule, run: rule.run, input, options: rule.options });

			findings.push(...raw.map((finding) => ({ ...finding, rule: rule.name, severity: rule.severity })));
		}

		progress(`${kind}: done`);
	}

	return { findings, skipped };
};

interface Params {
	cwd: string;
	packs: LoadedStandardsLibrary[];
	states: Map<string, ResolvedRuleState>;
	/** Active framework channels — rules on inactive channels do not run (base always runs). */
	channels: string[];
	/** Monorepo package parent dir (config `packages-dir`), default 'packages'. */
	packagesDir?: string;
	/** Repo-relative subpath to check (default: the whole repo). */
	path?: string;
	/** Path prefixes to exclude (the config's `generated` list). */
	exclude?: string[];
	onProgress?: (message: string) => void;
}

/**
 * Each input is built once and shared, except clone-spans: its detector is
 * driven by the `minTokens` in the asking rule's own options, and two rules with different
 * thresholds are two different detections.
 *
 * A rule's full name and severity are stamped here rather than inside the
 * check, so a check cannot name them wrong; its site keys arrive already
 * prefixed with that full name.
 *
 * @throws {Error} When a check throws or returns something that is not a list of findings — a broken check is a pack bug, not a finding.
 */
export const runPackageChecks = async ({
	cwd,
	packs,
	states,
	channels,
	packagesDir = defaultPackagesDir,
	path,
	exclude,
	onProgress,
}: Params): Promise<{ findings: StandardsFinding[]; notes: string[] }> => {
	const progress = onProgress ?? (() => undefined);
	const { files: repoFiles, standardsLibraries } = await listSourceFiles({ cwd, exclude });
	const allFiles = repoFiles.filter((file) => !path || file.startsWith(path));
	const source = allFiles.filter((file) => !isTestFile({ path: file, standardsLibraries }));
	const tests = allFiles.filter((file) => isTestFile({ path: file, standardsLibraries }));
	const notes: string[] = [];

	progress(`checking ${source.length} source file(s) and ${tests.length} test file(s)`);

	const compiler = resolveConsumerTypescript({ cwd, packagesDir });
	const live = selectLiveRules({ packs, states, channels });
	const cache = new Map<string, string>();

	const buildInput: BuildInput = async ({ kind, options }) =>
		buildCheckInput({ kind, cwd, source, tests, files: allFiles, referenceFiles: repoFiles, standardsLibraries, packagesDir, options, cache, compiler });

	const { findings, skipped } = await runLiveRules({ live, buildInput, compiler, progress });

	if (skipped.length > 0) {
		notes.push(`${skipped.join(', ')} skipped — no typescript resolvable from the target repo`);
	}

	// Gated on the rules rather than on whether the cache holds an alias
	// declaration: a repo that declares aliases nowhere is precisely the case
	// worth reporting.
	const uncovered = live.some((rule) => rule.inputKind === StandardsInputKind.FileText)
		? findFoldersWithoutAliasSource({ files: allFiles, contents: cache })
		: [];

	if (uncovered.length > 0) {
		notes.push(
			`no package.json with imports and no tsconfig above ${uncovered.length} folder(s) — path aliases are unknown there, so the barrel and import rules stayed silent rather than guess: ${uncovered.slice(0, 5).join(', ')}${uncovered.length > 5 ? ', …' : ''}`,
		);
	}

	return { findings, notes };
};
