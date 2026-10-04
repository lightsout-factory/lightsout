import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { type FileListInput, type StandardsCheckFunction, type StandardsCheckInputs, StandardsInputKind } from '@lightsout/standards-contracts';
import type { LoadedStandardsRule } from '#src/common/types/LoadedStandardsRule.ts';
import type { LoadedStandardsTopic } from '#src/common/types/LoadedStandardsTopic.ts';
import type { ResolvedRuleState } from '#src/common/types/ResolvedRuleState.ts';
import type { StandardsGroup } from '#src/common/types/StandardsGroup.ts';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import { runPackageChecks } from '#src/standardsCheck/runStandardsCheck/runPackageChecks/runPackageChecks.ts';
import { getRejectionError } from '#tests/helpers/getRejectionError.ts';

/** A repo the checks run against. */
const setupRepo = () => {
	const cwd = mkdtempSync(join(tmpdir(), 'lightsout-package-checks-'));

	mkdirSync(join(cwd, 'src/feature'), { recursive: true });
	writeFileSync(join(cwd, 'src/alpha.ts'), 'export const alpha = 1;\n');
	writeFileSync(join(cwd, 'src/feature/internal.ts'), 'export const internal = 2;\n');
	writeFileSync(join(cwd, 'src/alpha.unit.test.ts'), "test('alpha', () => {});\n");
	// A real repo has one, and without it the run rightly notes that it could not
	// know this repo's path aliases — a second note every unrelated case would
	// then have to carry.
	writeFileSync(join(cwd, 'tsconfig.json'), '{ "compilerOptions": { "strict": true } }\n');

	return { cwd };
};

const rule = (overrides: Partial<LoadedStandardsRule> & { id: string }): LoadedStandardsRule => ({
	name: `acme/${overrides.id}`,
	library: 'acme',
	set: 'code',
	documentPath: 'code/style-guide/structure/module-api',
	summary: 'a rule',
	prose: 'the argument for the rule',
	deterministic: overrides.run !== undefined,
	agent: overrides.run === undefined,
	defaultSeverity: StandardsSeverity.Advisory,
	defaultOptions: {},
	requires: [],
	fixturesPath: `/packages/acme/${overrides.id}/fixtures`,
	...overrides,
});

/** A check for the rule `id` that reports one finding and records what it was handed. */
const recordingRun = ({
	id,
	calls,
}: {
	id: string;
	calls: Array<{ inputs: StandardsCheckInputs; options: Record<string, number> }>;
}): StandardsCheckFunction => {
	return ({ inputs, options }) => {
		calls.push({ inputs, options });

		return [{ siteKey: `${id}:${Object.keys(inputs).join(',')}:one`, files: [{ path: 'src/alpha.ts' }], detail: 'one site' }];
	};
};

/** The first input a check was handed, narrowed to the kind whose path lists the test reads. */
const fileListInput = ({ calls }: { calls: Array<{ inputs: StandardsCheckInputs }> }): FileListInput => {
	const input = calls[0]?.inputs[StandardsInputKind.FileList];

	if (input === undefined) {
		throw new Error(`expected a file-list input, got ${Object.keys(calls[0]?.inputs ?? {}).join(',') || 'none'}`);
	}

	return input;
};

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

/** Runs the given rules as one group's pack, at the severities a repo's config would have resolved for them. */
const runChecks = ({
	rules,
	cwd,
	severities = {},
	path,
	exclude,
	onProgress,
}: {
	rules: LoadedStandardsRule[];
	cwd: string;
	severities?: Record<string, StandardsSeverity>;
	path?: string;
	exclude?: string[];
	onProgress?: (message: string) => void;
}) => {
	const states = new Map<string, ResolvedRuleState>(
		rules.map((entry) => {
			const severity = severities[entry.id] ?? entry.defaultSeverity;

			return [entry.name, { severity, options: entry.defaultOptions, fromConfig: false, reachesAgents: severity !== StandardsSeverity.Off }];
		}),
	);

	return runPackageChecks({ cwd, groups: [groupOf({ rules, states })], path, exclude, onProgress });
};

/**
 * Two checked rules, one retuned by the repo's config, with each check
 * recording the options it was run with. The retuned rule's state carries the
 * config's options merged over its defaults, as the repo's settings resolve it.
 */
const setupConfiguredRun = () => {
	const { cwd } = setupRepo();
	const calls: Record<string, Record<string, number>> = {};
	const recordOptions =
		({ id }: { id: string }): StandardsCheckFunction =>
		({ options }) => {
			calls[id] = options;

			return [];
		};
	const rules = [
		rule({ id: 'folder-size', inputKinds: [StandardsInputKind.FileList], run: recordOptions({ id: 'folder-size' }), defaultOptions: { cap: 20 } }),
		rule({ id: 'file-size', inputKinds: [StandardsInputKind.FileList], run: recordOptions({ id: 'file-size' }), defaultOptions: { file: 250, tsxFile: 300 } }),
	];
	const states = new Map<string, ResolvedRuleState>([
		['acme/folder-size', { severity: StandardsSeverity.Advisory, options: { cap: 2 }, fromConfig: true, reachesAgents: true }],
		['acme/file-size', { severity: StandardsSeverity.Advisory, options: { file: 250, tsxFile: 300 }, fromConfig: false, reachesAgents: true }],
	]);

	return { cwd, groups: [groupOf({ rules, states })], calls };
};

/** One live checked rule `acme/size` whose check writes its site keys with the short id, as every check does. */
const setupFullNameRun = () => {
	const { cwd } = setupRepo();
	const sizeRun: StandardsCheckFunction = () => [{ siteKey: 'size:src/alpha.ts', files: [{ path: 'src/alpha.ts' }], detail: 'too big' }];
	const rules = [rule({ id: 'size', name: 'acme/size', library: 'acme', inputKinds: [StandardsInputKind.FileText], run: sizeRun })];
	const states = new Map<string, ResolvedRuleState>([
		['acme/size', { severity: StandardsSeverity.Advisory, options: {}, fromConfig: false, reachesAgents: true }],
	]);

	return { cwd, groups: [groupOf({ rules, states })] };
};

/**
 * One group whose pack holds a live rule `acme/size` and a rule `acme/muted` the
 * repo turned off, while the library's checked rule `acme/outside` shares their
 * topic but was left out of the pack. Each check records its id when it runs.
 */
const setupGroupRun = () => {
	const { cwd } = setupRepo();
	const ran: string[] = [];
	const reportingRun =
		({ id }: { id: string }): StandardsCheckFunction =>
		() => {
			ran.push(id);

			return [{ siteKey: `${id}:src/alpha.ts`, files: [{ path: 'src/alpha.ts' }], detail: `${id} site` }];
		};
	const size = rule({ id: 'size', inputKinds: [StandardsInputKind.FileText], run: reportingRun({ id: 'size' }) });
	const muted = rule({ id: 'muted', inputKinds: [StandardsInputKind.FileText], run: reportingRun({ id: 'muted' }) });
	const outside = rule({ id: 'outside', inputKinds: [StandardsInputKind.FileText], run: reportingRun({ id: 'outside' }) });
	const topic: LoadedStandardsTopic = {
		set: 'code',
		library: 'acme',
		path: 'code/style-guide/structure/module-api',
		intro: '# Module API',
		ruleIds: [size.id, muted.id, outside.id],
	};
	const group: StandardsGroup = {
		packages: [''],
		pack: {
			name: 'acme/house',
			topics: [topic],
			rules: [
				{ rule: size, severity: StandardsSeverity.Advisory, options: {} },
				{ rule: muted, severity: StandardsSeverity.Blocking, options: {} },
			],
			conditionalPacks: [],
			inactiveRules: [],
		},
		states: new Map([
			['acme/size', { severity: StandardsSeverity.Advisory, options: {}, fromConfig: false, reachesAgents: true }],
			['acme/muted', { severity: StandardsSeverity.Off, options: {}, fromConfig: true, reachesAgents: true }],
		]),
	};

	return { cwd, groups: [group], ran };
};

describe('runPackageChecks', () => {
	test('stamps each finding with the rule id it came from and the severity the repo resolved', async () => {
		const { cwd } = setupRepo();
		const calls: Array<{ inputs: StandardsCheckInputs; options: Record<string, number> }> = [];

		const { findings } = await runChecks({
			cwd,
			rules: [
				rule({
					id: 'multi-export',
					inputKinds: [StandardsInputKind.FileText],
					run: recordingRun({ id: 'multi-export', calls }),
					defaultSeverity: StandardsSeverity.Advisory,
				}),
			],
			severities: { 'multi-export': StandardsSeverity.Blocking },
		});

		// the check never names either — the folder owns the id, the config the severity
		expect(findings).toStrictEqual([
			{
				rule: 'acme/multi-export',
				severity: StandardsSeverity.Blocking,
				siteKey: 'acme/multi-export:file-text:one',
				files: [{ path: 'src/alpha.ts' }],
				detail: 'one site',
			},
		]);
	});

	test('hands a check declaring several kinds every one of them, in a single call', async () => {
		const { cwd } = setupRepo();
		const calls: Array<{ inputs: StandardsCheckInputs; options: Record<string, number> }> = [];

		await runChecks({
			cwd,
			rules: [rule({ id: 'both', inputKinds: [StandardsInputKind.FileList, StandardsInputKind.FileText], run: recordingRun({ id: 'both', calls }) })],
		});

		// one call, both shapes, and nothing the rule did not ask for
		expect(calls).toHaveLength(1);
		expect(Object.keys(calls[0]?.inputs ?? {}).sort()).toStrictEqual(['file-list', 'file-text']);
		expect(calls[0]?.inputs['file-text']?.contents.get('src/alpha.ts')).toBe('export const alpha = 1;\n');
	});

	test('builds one input per kind and hands the very same one to every rule that asked for it', async () => {
		const { cwd } = setupRepo();
		const calls: Array<{ inputs: StandardsCheckInputs; options: Record<string, number> }> = [];

		await runChecks({
			cwd,
			rules: [
				rule({ id: 'first', inputKinds: [StandardsInputKind.FileText], run: recordingRun({ id: 'first', calls }) }),
				rule({ id: 'second', inputKinds: [StandardsInputKind.FileText], run: recordingRun({ id: 'second', calls }) }),
			],
		});

		expect(calls).toHaveLength(2);
		// one build, one read of every file, however many rules want the text
		expect(calls[0]?.inputs['file-text']).toBe(calls[1]?.inputs['file-text']);
	});

	test('gives each duplicate-block rule its own detection, because the detector runs on the options of that rule', async () => {
		const { cwd } = setupRepo();
		const calls: Array<{ inputs: StandardsCheckInputs; options: Record<string, number> }> = [];

		await runChecks({
			cwd,
			rules: [
				rule({
					id: 'duplicate-code-block',
					inputKinds: [StandardsInputKind.CloneSpans],
					run: recordingRun({ id: 'duplicate-code-block', calls }),
					defaultOptions: { minTokens: 50 },
				}),
				rule({
					id: 'duplicate-code-block-strict',
					inputKinds: [StandardsInputKind.CloneSpans],
					run: recordingRun({ id: 'duplicate-code-block-strict', calls }),
					defaultOptions: { minTokens: 200 },
				}),
			],
		});

		expect(calls[0]?.inputs['clone-spans']).not.toBe(calls[1]?.inputs['clone-spans']);
		expect(calls[0]?.options).toStrictEqual({ minTokens: 50 });
		expect(calls[1]?.options).toStrictEqual({ minTokens: 200 });
	});

	test('runs nothing for a rule the repo switched off', async () => {
		const { cwd } = setupRepo();
		const calls: Array<{ inputs: StandardsCheckInputs; options: Record<string, number> }> = [];

		const { findings } = await runChecks({
			cwd,
			rules: [rule({ id: 'multi-export', inputKinds: [StandardsInputKind.FileText], run: recordingRun({ id: 'multi-export', calls }) })],
			severities: { 'multi-export': StandardsSeverity.Off },
		});

		// off is a configuration state: the check is never even called
		expect(calls).toHaveLength(0);
		expect(findings).toStrictEqual([]);
	});

	test('ignores a agent-only rule, which ships no check to run', async () => {
		const { cwd } = setupRepo();

		const { findings, notes } = await runChecks({ cwd, rules: [rule({ id: 'premature-abstraction' })] });

		expect(findings).toStrictEqual([]);
		expect(notes).toStrictEqual([]);
	});

	test('scopes the checked files to --path while keeping the whole repo as reference', async () => {
		const { cwd } = setupRepo();
		const calls: Array<{ inputs: StandardsCheckInputs; options: Record<string, number> }> = [];

		await runChecks({
			cwd,
			rules: [rule({ id: 'multi-export', inputKinds: [StandardsInputKind.FileList], run: recordingRun({ id: 'multi-export', calls }) })],
			path: 'src/feature',
		});

		const input = fileListInput({ calls });

		expect(input.files).toStrictEqual(['src/feature/internal.ts']);
		// reference files stay unfiltered — a consumer outside the scope still counts
		expect(input.referenceFiles).toContain('src/alpha.ts');
	});

	test('drops the excluded paths a repo declared generated', async () => {
		const { cwd } = setupRepo();
		const calls: Array<{ inputs: StandardsCheckInputs; options: Record<string, number> }> = [];

		await runChecks({
			cwd,
			rules: [rule({ id: 'multi-export', inputKinds: [StandardsInputKind.FileList], run: recordingRun({ id: 'multi-export', calls }) })],
			exclude: ['src/feature'],
		});

		expect(fileListInput({ calls }).referenceFiles).not.toContain('src/feature/internal.ts');
	});

	test('reports progress as the file count first and then each input kind it built', async () => {
		const { cwd } = setupRepo();
		const calls: Array<{ inputs: StandardsCheckInputs; options: Record<string, number> }> = [];
		const messages: string[] = [];

		await runChecks({
			cwd,
			rules: [rule({ id: 'multi-export', inputKinds: [StandardsInputKind.FileText], run: recordingRun({ id: 'multi-export', calls }) })],
			onProgress: (message) => messages.push(message),
		});

		expect(messages).toStrictEqual(['checking 2 source file(s) and 1 test file(s)', 'file-text: built']);
	});

	test('names the rule when its check returns something that is not a list of findings', async () => {
		const { cwd } = setupRepo();
		const brokenRun = (() => 'not findings at all') as unknown as StandardsCheckFunction;

		const error = await getRejectionError({
			promise: runChecks({ cwd, rules: [rule({ id: 'multi-export', inputKinds: [StandardsInputKind.FileText], run: brokenRun })] }),
		});

		// a broken check is a package bug, not a finding
		expect(error.message).toContain('standards rule "acme/multi-export" returned something that is not a list of findings');
	});

	test('names the offending field when a check returns a finding that is missing one', async () => {
		const { cwd } = setupRepo();
		const shortRun = (() => [{ siteKey: 'a-site', files: [{ path: 'src/alpha.ts' }] }]) as unknown as StandardsCheckFunction;

		const error = await getRejectionError({
			promise: runChecks({ cwd, rules: [rule({ id: 'multi-export', inputKinds: [StandardsInputKind.FileText], run: shortRun })] }),
		});

		// the author has to be told which finding and which field, not just "invalid"
		expect(error.message).toContain('standards rule "acme/multi-export"');
		expect(error.message).toContain('0.detail');
	});

	test('names the rule when its check throws', async () => {
		const { cwd } = setupRepo();
		const throwingRun: StandardsCheckFunction = () => {
			throw new Error('cannot parse that');
		};

		const error = await getRejectionError({
			promise: runChecks({ cwd, rules: [rule({ id: 'multi-export', inputKinds: [StandardsInputKind.FileText], run: throwingRun })] }),
		});

		expect(error.message).toBe('standards rule "acme/multi-export" threw while checking: cannot parse that');
	});

	test('leaves a rule out when the run was handed no resolved state for it', async () => {
		const { cwd } = setupRepo();
		const calls: Array<{ inputs: StandardsCheckInputs; options: Record<string, number> }> = [];
		const rules = [rule({ id: 'multi-export', inputKinds: [StandardsInputKind.FileText], run: recordingRun({ id: 'multi-export', calls }) })];

		const { findings } = await runPackageChecks({ cwd, groups: [groupOf({ rules, states: new Map() })] });

		// severity is policy; with none resolved there is nothing to report at
		expect(findings).toStrictEqual([]);
	});

	test('runs each live rule with its resolved options, the config override merged over its defaults', async () => {
		const { cwd, groups, calls } = setupConfiguredRun();

		await runPackageChecks({ cwd, groups });

		expect(calls).toStrictEqual({ 'folder-size': { cap: 2 }, 'file-size': { file: 250, tsxFile: 300 } });
	});

	test('findings carry the full rule name and a site key prefixed with it', async () => {
		const { cwd, groups } = setupFullNameRun();

		const { findings } = await runPackageChecks({ cwd, groups });

		expect(findings).toStrictEqual([
			{ rule: 'acme/size', severity: StandardsSeverity.Advisory, siteKey: 'acme/size:src/alpha.ts', files: [{ path: 'src/alpha.ts' }], detail: 'too big' },
		]);
	});

	test("runPackageChecks: only rules in a group's pack at a reporting severity run", async () => {
		const { cwd, groups, ran } = setupGroupRun();

		const { findings } = await runPackageChecks({ cwd, groups });

		expect({ ran, findings }).toStrictEqual({
			ran: ['size'],
			findings: [
				{ rule: 'acme/size', severity: StandardsSeverity.Advisory, siteKey: 'acme/size:src/alpha.ts', files: [{ path: 'src/alpha.ts' }], detail: 'size site' },
			],
		});
	});

	test('a checked rule two groups hold runs once, by full name', async () => {
		const { cwd } = setupRepo();
		const calls: Array<{ inputs: StandardsCheckInputs; options: Record<string, number> }> = [];
		const rules = [rule({ id: 'size', inputKinds: [StandardsInputKind.FileText], run: recordingRun({ id: 'size', calls }) })];
		const states = new Map<string, ResolvedRuleState>([
			['acme/size', { severity: StandardsSeverity.Advisory, options: {}, fromConfig: false, reachesAgents: true }],
		]);

		const { findings } = await runPackageChecks({ cwd, groups: [groupOf({ rules, states }), groupOf({ rules, states })] });

		expect({ runs: calls.length, keys: findings.map((finding) => finding.siteKey) }).toStrictEqual({ runs: 1, keys: ['acme/size:file-text:one'] });
	});

	test('runPackageChecks: no groups means nothing runs', async () => {
		const { cwd } = setupRepo();
		const messages: string[] = [];

		const result = await runPackageChecks({ cwd, groups: [], onProgress: (message) => messages.push(message) });

		// only the file count is reported: no input kind was built, so no check ran
		expect({ result, messages }).toStrictEqual({
			result: { findings: [], notes: [] },
			messages: ['checking 2 source file(s) and 1 test file(s)'],
		});
	});
});
