import type { RawStandardsFinding, StandardsCheckFunction, StandardsInputKind } from '@lightsout/standards-contracts';
import type ts from 'typescript';
import { defaultPackagesDir } from '#src/common/constants/defaultPackagesDir.ts';
import { isTestFile } from '#src/common/sourceFiles/isTestFile.ts';
import { listSourceFiles } from '#src/common/sourceFiles/listSourceFiles.ts';
import { buildCheckInput } from '#src/standardsCheck/internal/common/checkInputs/buildCheckInput.ts';
import { buildCheckInputs } from '#src/standardsCheck/internal/common/checkInputs/buildCheckInputs.ts';
import { runRuleCheck } from '#src/standardsCheck/internal/common/utils/runRuleCheck.ts';
import type { LoadedStandardsRule } from '#src/standardsLibraries/common/types/LoadedStandardsRule.ts';

interface Params {
	/** Absolute path of the tree to check, run against as if it were a whole repo. */
	cwd: string;
	rule: LoadedStandardsRule;
	inputKinds: StandardsInputKind[];
	run: StandardsCheckFunction;
	/** How a thrown message names the tree, such as `fixtures/pass/`. */
	label: string;
	compiler?: typeof ts;
}

/**
 * The tree is named by the caller rather than derived here: a rule's own pair
 * is `fixtures/<side>/` under the rule folder.
 *
 * @throws {Error} When a type-checker rule's tree carries no tsconfig, or the check itself misbehaves.
 */
export const checkFixtureTree = async ({ cwd, rule, inputKinds, run, label, compiler }: Params): Promise<RawStandardsFinding[]> => {
	const { files } = await listSourceFiles({ cwd });
	const cache = new Map<string, string>();
	const inputs = await buildCheckInputs({
		kinds: inputKinds,
		inputFor: ({ kind }) =>
			buildCheckInput({
				kind,
				cwd,
				source: files.filter((file) => !isTestFile({ path: file })),
				tests: files.filter((file) => isTestFile({ path: file })),
				files,
				referenceFiles: files,
				// A fixture tree is a miniature repo of its own; it declares no pack.
				standardsLibraries: [],
				packagesDir: defaultPackagesDir,
				options: rule.defaultOptions,
				cache,
				compiler,
			}),
	});

	// Without a tsconfig the check is handed nothing and answers nothing, which
	// would otherwise be reported as "the check does not catch what the rule
	// describes" — the wrong file to go looking in.
	if (inputs['type-checker']?.typedFiles.size === 0 && files.length > 0) {
		throw new Error(`no tsconfig.json in ${label}, so none of its ${files.length} file(s) could be typed — a type-checker rule's fixtures need one`);
	}

	return runRuleCheck({ rule, run, inputs, options: rule.defaultOptions });
};
