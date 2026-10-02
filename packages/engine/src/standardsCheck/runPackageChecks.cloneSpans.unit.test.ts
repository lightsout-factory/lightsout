import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { type CloneSpansInput, type StandardsCheckFunction, type StandardsCheckInputs, StandardsInputKind } from '@lightsout/standards-contracts';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import type { StandardsGroup } from '#src/standards/common/types/StandardsGroup.ts';
import type { ResolvedRuleState } from '#src/standardsCheck/common/types/ResolvedRuleState.ts';
import { runPackageChecks } from '#src/standardsCheck/runPackageChecks.ts';
import type { LoadedStandardsRule } from '#src/standardsLibraries/common/types/LoadedStandardsRule.ts';
import { delegatingSources, duplicatedSources, offsetImportSources, sharedImportSources, writeSampleSources } from '#tests/helpers/duplicationSamples.ts';
import { linkTypescript } from '#tests/helpers/linkTypescript.ts';

/** One group whose pack holds `rules` at their rule.md defaults, each rule at the state `states` resolved for it. */
const groupOf = ({ rules, states }: { rules: LoadedStandardsRule[]; states: Map<string, ResolvedRuleState> }): StandardsGroup => ({
	packages: [''],
	pack: {
		name: 'acme/house',
		topics: [],
		rules: rules.map((entry) => ({ rule: entry, severity: entry.defaultSeverity, options: entry.defaultOptions })),
		conditionalPacks: [],
		inactiveRules: [],
	},
	states,
});

/**
 * A repo holding the given sources, checked by one duplicate-block rule that
 * records the input the run handed it. `typescript` is what decides whether the
 * run can parse the repo: without one, the delegation blanking is skipped
 * rather than guessed.
 */
const setupDuplicationRun = ({ sources, typescript = false }: { sources: Record<string, string>; typescript?: boolean }) => {
	const cwd = mkdtempSync(join(tmpdir(), 'lightsout-package-checks-duplication-'));
	const handed: StandardsCheckInputs[] = [];
	const run: StandardsCheckFunction = ({ inputs }) => {
		handed.push(inputs);

		return [];
	};

	writeSampleSources({ dir: cwd, sources });

	if (typescript) {
		linkTypescript({ dir: cwd });
	}

	const options = { minTokens: 50 };
	const rule: LoadedStandardsRule = {
		id: 'duplicate-code-block',
		name: 'acme/duplicate-code-block',
		library: 'acme',
		set: 'code',
		documentPath: 'code/architecture/architecture-decisions',
		summary: 'the same block of code written out in two or more files',
		prose: 'the argument for the rule',
		checked: true,
		reviewed: false,
		defaultSeverity: StandardsSeverity.Advisory,
		defaultOptions: options,
		requires: [],
		fixturesPath: '/packages/acme/duplicate-code-block/fixtures',
		inputKinds: [StandardsInputKind.CloneSpans],
		run,
	};
	const states = new Map<string, ResolvedRuleState>([
		['acme/duplicate-code-block', { severity: StandardsSeverity.Advisory, options, fromConfig: false, reachesAgents: true }],
	]);

	return { cwd, handed, groups: [groupOf({ rules: [rule], states })] };
};

/**
 * A repo holding one duplicated block, checked by two duplicate-block rules
 * that differ only in their `minTokens` option. Each rule records the input
 * its own run handed it.
 */
const setupThresholdRun = ({ lowMinTokens, highMinTokens }: { lowMinTokens: number; highMinTokens: number }) => {
	const cwd = mkdtempSync(join(tmpdir(), 'lightsout-package-checks-thresholds-'));
	const lowHanded: StandardsCheckInputs[] = [];
	const highHanded: StandardsCheckInputs[] = [];

	writeSampleSources({ dir: cwd, sources: duplicatedSources });

	const buildRule = ({ id, minTokens, handed }: { id: string; minTokens: number; handed: StandardsCheckInputs[] }): LoadedStandardsRule => ({
		id,
		name: `acme/${id}`,
		library: 'acme',
		set: 'code',
		documentPath: 'code/architecture/architecture-decisions',
		summary: 'the same block of code written out in two or more files',
		prose: 'the argument for the rule',
		checked: true,
		reviewed: false,
		defaultSeverity: StandardsSeverity.Advisory,
		defaultOptions: { minTokens },
		requires: [],
		fixturesPath: `/packages/acme/${id}/fixtures`,
		inputKinds: [StandardsInputKind.CloneSpans],
		run: ({ inputs }) => {
			handed.push(inputs);

			return [];
		},
	});
	const rules = [
		buildRule({ id: 'duplicate-code-block-low', minTokens: lowMinTokens, handed: lowHanded }),
		buildRule({ id: 'duplicate-code-block-high', minTokens: highMinTokens, handed: highHanded }),
	];
	const states = new Map<string, ResolvedRuleState>([
		['acme/duplicate-code-block-low', { severity: StandardsSeverity.Advisory, options: { minTokens: lowMinTokens }, fromConfig: false, reachesAgents: true }],
		['acme/duplicate-code-block-high', { severity: StandardsSeverity.Advisory, options: { minTokens: highMinTokens }, fromConfig: false, reachesAgents: true }],
	]);

	return { cwd, groups: [groupOf({ rules, states })], lowHanded, highHanded };
};

/** The one clone-spans input the run built, read off what the rule was handed. */
const cloneSpansInput = ({ handed }: { handed: StandardsCheckInputs[] }): CloneSpansInput => {
	const input = handed[0]?.[StandardsInputKind.CloneSpans];

	if (input === undefined) {
		throw new Error(`expected a clone-spans input, got ${Object.keys(handed[0] ?? {}).join(',') || 'none'}`);
	}

	return input;
};

/** The paths the first span names, sorted — the detector decides which site it reports first, which is not the contract. */
const sitesOf = ({ input }: { input: CloneSpansInput }) => (input.spans[0]?.files ?? []).map((file) => file.path).sort();

/** Where the first span starts in one of its two files. */
const startLineOf = ({ input, path }: { input: CloneSpansInput; path: string }) => input.spans[0]?.files.find((file) => file.path === path)?.startLine ?? 0;

describe('runPackageChecks', () => {
	test('hands a duplicate-block rule both sites of a duplicated span and the tokens it spans', async () => {
		const { cwd, handed, groups } = setupDuplicationRun({ sources: duplicatedSources });

		await runPackageChecks({ cwd, groups });

		const input = cloneSpansInput({ handed });

		// the rule opens no file of its own: the engine runs the detector, so the
		// two sites and the size of the span arrive on the input it was handed
		expect(input.spans).toHaveLength(1);
		expect(sitesOf({ input })).toStrictEqual(['src/alpha.ts', 'src/beta.ts']);
		expect(input.spans[0]?.tokens).toBeGreaterThanOrEqual(50);
	});

	test('reports the line numbers of the file as written, not of the blanked copy the detector read', async () => {
		const { cwd, handed, groups } = setupDuplicationRun({ sources: offsetImportSources });

		await runPackageChecks({ cwd, groups });

		const input = cloneSpansInput({ handed });
		const alphaLine = startLineOf({ input, path: 'src/alpha.ts' });
		const betaLine = startLineOf({ input, path: 'src/beta.ts' });

		// alpha's body cannot start above line 3, and beta's identical copy sits
		// four lines lower under a four-line-longer import list — the offset only
		// survives if the imports were blanked in place rather than cut out
		expect(alphaLine).toBeGreaterThanOrEqual(3);
		expect(betaLine - alphaLine).toBe(4);
	});

	test('never counts a shared import list as duplication, because nobody can deduplicate one', async () => {
		const { cwd, handed, groups } = setupDuplicationRun({ sources: sharedImportSources });

		await runPackageChecks({ cwd, groups });

		const input = cloneSpansInput({ handed });

		// on its own the shared list clears the detector's floor, so silence here
		// is the blanking rather than a fixture too small to trip anything
		expect(input.spans).toStrictEqual([]);
	});

	test('blanks the composition remedy out of the detection when the repo has a typescript to parse with', async () => {
		const { cwd, handed, groups } = setupDuplicationRun({ sources: delegatingSources, typescript: true });

		await runPackageChecks({ cwd, groups });

		const input = cloneSpansInput({ handed });

		// two classes holding the same collaborator repeat the forwarding shape BY
		// DESIGN — the standards mandate it in place of `extends`, so reporting it
		// would hand a refactor agent the remedy as the disease
		expect(input.spans).toStrictEqual([]);
	});

	test('leaves the composition remedy in the detection rather than guessing at it when the repo has no typescript', async () => {
		const { cwd, handed, groups } = setupDuplicationRun({ sources: delegatingSources });

		await runPackageChecks({ cwd, groups });

		const input = cloneSpansInput({ handed });

		// the blanking needs a parsed tree; without one the run reports what the
		// tokens say rather than pretending to know the shape
		expect(sitesOf({ input })).toStrictEqual(['src/PipelineRun.ts', 'src/RefactorRun.ts']);
	});

	test('builds a separate clone detection for each rule from its own minTokens option', async () => {
		const { cwd, groups, lowHanded, highHanded } = setupThresholdRun({ lowMinTokens: 20, highMinTokens: 200 });

		await runPackageChecks({ cwd, groups });

		const lowInput = cloneSpansInput({ handed: lowHanded });
		const highInput = cloneSpansInput({ handed: highHanded });

		// the duplicated block clears 20 tokens but not 200, so a single shared
		// detection would hand both rules the same spans
		expect({ low: sitesOf({ input: lowInput }), high: highInput.spans }).toStrictEqual({ low: ['src/alpha.ts', 'src/beta.ts'], high: [] });
	});
});
