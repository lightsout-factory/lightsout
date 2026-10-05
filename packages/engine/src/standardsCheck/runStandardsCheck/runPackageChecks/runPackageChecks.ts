import { type RawStandardsFinding, type StandardsCheckFunction, type StandardsCheckInput, StandardsInputKind } from '@lightsout/standards-contracts';
import { defaultPackagesDir } from '#src/common/constants/defaultPackagesDir.ts';
import { canonicalJson } from '#src/common/json/canonicalJson.ts';
import { isTestFile } from '#src/common/sourceFiles/isTestFile.ts';
import { listSourceFiles } from '#src/common/sourceFiles/listSourceFiles.ts';
import type { StandardsGroup } from '#src/common/types/StandardsGroup.ts';
import { listWorkspacePackages } from '#src/common/workspace/listWorkspacePackages.ts';
import { resolveConsumerTypescript } from '#src/common/workspace/resolveConsumerTypescript.ts';
import type { StandardsFinding } from '#src/contracts/standardsCheck/StandardsFinding.ts';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import { buildCheckInput } from '#src/standardsCheck/common/buildCheckInput/buildCheckInput.ts';
import { buildCheckInputs } from '#src/standardsCheck/common/buildCheckInputs.ts';
import { typescriptInputKinds } from '#src/standardsCheck/common/constants/typescriptInputKinds.ts';
import { findFileStandardsGroup } from '#src/standardsCheck/common/findFileStandardsGroup.ts';
import { runRuleCheck } from '#src/standardsCheck/common/runRuleCheck.ts';
import { findFoldersWithoutAliasSource } from '#src/standardsCheck/runStandardsCheck/runPackageChecks/findFoldersWithoutAliasSource.ts';

interface Grader {
	group: StandardsGroup;
	/** Only the two reporting severities — a group running the rule `off` never grades it. */
	severity: StandardsFinding['severity'];
}

interface LiveRule {
	id: string;
	/** The full `<library>/<rule-id>` name every finding carries. */
	name: string;
	inputKinds: StandardsInputKind[];
	run: StandardsCheckFunction;
	options: Record<string, number>;
	/** Each group running the rule at these options, with the severity it grades at. */
	graders: Grader[];
}

/** A rule runs once per distinct options, for every group that holds it at those options and a reporting severity. */
const selectLiveRules = ({ groups }: { groups: StandardsGroup[] }) => {
	const live = new Map<string, LiveRule>();

	for (const group of groups) {
		for (const { rule } of group.pack.rules) {
			const state = group.states.get(rule.name);

			if (rule.run === undefined || rule.inputKinds === undefined || state === undefined || state.severity === StandardsSeverity.Off) {
				continue;
			}

			const key = canonicalJson({ value: [rule.name, state.options] });
			const entry = live.get(key) ?? { id: rule.id, name: rule.name, inputKinds: rule.inputKinds, run: rule.run, options: state.options, graders: [] };

			entry.graders.push({ group, severity: state.severity });
			live.set(key, entry);
		}
	}

	return [...live.values()];
};

type BuildInput = (params: { kind: StandardsInputKind; options: Record<string, number> }) => Promise<StandardsCheckInput>;

type GroupOfFile = (file: string | undefined) => StandardsGroup | undefined;

/** A finding is kept only when the group holding its first file runs this rule at these options, and takes that group's severity. */
const gradeFindings = ({ rule, raw, groupOfFile }: { rule: LiveRule; raw: RawStandardsFinding[]; groupOfFile: GroupOfFile }) =>
	raw.flatMap((finding) => {
		const group = groupOfFile(finding.files[0]?.path);
		const grader = rule.graders.find((candidate) => candidate.group === group);

		return grader === undefined ? [] : [{ ...finding, rule: rule.name, severity: grader.severity }];
	});

/**
 * Every kind but clone-spans is options-blind, so one build serves every rule
 * that asked for it; a clone-spans input is built per rule, on that rule's
 * options. A rule asking for a kind that needs TypeScript when none resolves
 * does not fail the run: it is named as skipped and the rest still report.
 */
const runLiveRules = async ({
	live,
	buildInput,
	groupOfFile,
	compiler,
	progress,
}: {
	live: LiveRule[];
	buildInput: BuildInput;
	groupOfFile: GroupOfFile;
	compiler: ReturnType<typeof resolveConsumerTypescript>;
	progress: (message: string) => void;
}) => {
	const findings: StandardsFinding[] = [];
	const skipped: string[] = [];
	const shared = new Map<StandardsInputKind, StandardsCheckInput>();
	const inputFor = async ({ kind, options }: { kind: StandardsInputKind; options: Record<string, number> }) => {
		if (kind === StandardsInputKind.CloneSpans) {
			const built = await buildInput({ kind, options });

			progress(`${kind}: built`);

			return built;
		}

		const built = shared.get(kind) ?? (await buildInput({ kind, options }));

		if (!shared.has(kind)) {
			shared.set(kind, built);
			progress(`${kind}: built`);
		}

		return built;
	};

	for (const rule of live) {
		if (compiler === undefined && rule.inputKinds.some((kind) => typescriptInputKinds.has(kind))) {
			skipped.push(rule.name);
			continue;
		}

		const inputs = await buildCheckInputs({ kinds: rule.inputKinds, inputFor: ({ kind }) => inputFor({ kind, options: rule.options }) });
		const raw = await runRuleCheck({ rule, run: rule.run, inputs, options: rule.options });

		findings.push(...gradeFindings({ rule, raw, groupOfFile }));
	}

	return { findings, skipped: [...new Set(skipped)] };
};

interface Params {
	cwd: string;
	/** The groups this check covers; a rule runs when a group's pack holds it at a reporting severity, and grades the findings in that group's files. */
	groups: StandardsGroup[];
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
 * thresholds are two different detections. A check declaring several kinds is
 * handed all of them in one call.
 *
 * A rule's full name and severity are stamped here rather than inside the
 * check, so a check cannot name them wrong; its site keys arrive already
 * prefixed with that full name. Every check reads the whole repo as reference
 * files, and each finding is graded by the group holding its first file: a
 * finding in a file no group covers, or whose group runs the rule `off` or at
 * other options, is dropped.
 *
 * @throws {Error} When a check throws or returns something that is not a list of findings — a broken check is a pack bug, not a finding.
 */
export const runPackageChecks = async ({
	cwd,
	groups,
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
	const live = selectLiveRules({ groups });
	const cache = new Map<string, string>();
	const workspacePackages = await listWorkspacePackages({ cwd, packagesDir });
	const groupOfFile: GroupOfFile = (file) => findFileStandardsGroup({ file, groups, packagesDir, workspacePackages });

	const buildInput: BuildInput = async ({ kind, options }) =>
		buildCheckInput({ kind, cwd, source, tests, files: allFiles, referenceFiles: repoFiles, standardsLibraries, packagesDir, options, cache, compiler });

	const { findings, skipped } = await runLiveRules({ live, buildInput, groupOfFile, compiler, progress });

	if (skipped.length > 0) {
		notes.push(`${skipped.join(', ')} skipped — no typescript resolvable from the target repo`);
	}

	// Gated on the rules rather than on whether the cache holds an alias
	// declaration: a repo that declares aliases nowhere is precisely the case
	// worth reporting.
	const uncovered = live.some((rule) => rule.inputKinds.includes(StandardsInputKind.FileText))
		? findFoldersWithoutAliasSource({ files: allFiles, contents: cache })
		: [];

	if (uncovered.length > 0) {
		notes.push(
			`no package.json with imports and no tsconfig above ${uncovered.length} folder(s) — path aliases are unknown there, so the barrel and import rules stayed silent rather than guess: ${uncovered.slice(0, 5).join(', ')}${uncovered.length > 5 ? ', …' : ''}`,
		);
	}

	return { findings, notes };
};
