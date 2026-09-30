import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { type FileListInput, type StandardsCheckFunction, type StandardsCheckInput, StandardsInputKind } from '@lightsout/standards-contracts';
import { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import type { ResolvedRuleState } from '#src/standardsCheck/internal/common/types/ResolvedRuleState.ts';
import { resolvePackageRuleStates } from '#src/standardsCheck/resolvePackageRuleStates.ts';
import { runPackageChecks } from '#src/standardsCheck/runPackageChecks.ts';
import type { LoadedStandardsLibrary } from '#src/standardsLibraries/common/types/LoadedStandardsLibrary.ts';
import type { LoadedStandardsRule } from '#src/standardsLibraries/common/types/LoadedStandardsRule.ts';
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
	channel: 'base',
	checked: overrides.run !== undefined,
	defaultSeverity: StandardsSeverity.Advisory,
	defaultOptions: {},
	fixturesPath: `/packages/acme/${overrides.id}/fixtures`,
	...overrides,
});

/** A check for the rule `id` that reports one finding and records what it was handed. */
const recordingRun = ({ id, calls }: { id: string; calls: Array<{ input: StandardsCheckInput; options: Record<string, number> }> }): StandardsCheckFunction => {
	return ({ input, options }) => {
		calls.push({ input, options });

		return [{ siteKey: `${id}:${input.kind}:one`, files: [{ path: 'src/alpha.ts' }], detail: 'one site' }];
	};
};

/** The first input a check was handed, narrowed to the kind whose path lists the test reads. */
const fileListInput = ({ calls }: { calls: Array<{ input: StandardsCheckInput }> }): FileListInput => {
	const input = calls[0]?.input;

	if (input?.kind !== StandardsInputKind.FileList) {
		throw new Error(`expected a file-list input, got ${String(input?.kind)}`);
	}

	return input;
};

/** Runs the given rules as one loaded package, at the severities a repo's config would have resolved for them. */
const runChecks = ({
	rules,
	cwd,
	channels = [],
	severities = {},
	path,
	exclude,
	onProgress,
}: {
	rules: LoadedStandardsRule[];
	cwd: string;
	channels?: string[];
	severities?: Record<string, StandardsSeverity>;
	path?: string;
	exclude?: string[];
	onProgress?: (message: string) => void;
}) => {
	const pkg: LoadedStandardsLibrary = { name: 'acme', formatVersion: 1, rootPath: '/packages/acme', documents: [], rules };
	const states = new Map<string, ResolvedRuleState>(
		rules.map((entry) => [entry.name, { severity: severities[entry.id] ?? entry.defaultSeverity, options: entry.defaultOptions, fromConfig: false }]),
	);

	return runPackageChecks({ cwd, packs: [pkg], states, channels, path, exclude, onProgress });
};

/** Two checked rules, one retuned by the repo's config, with each check recording the options it was run with. */
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
		rule({ id: 'folder-size', inputKind: StandardsInputKind.FileList, run: recordOptions({ id: 'folder-size' }), defaultOptions: { cap: 20 } }),
		rule({ id: 'file-size', inputKind: StandardsInputKind.FileList, run: recordOptions({ id: 'file-size' }), defaultOptions: { file: 250, tsxFile: 300 } }),
	];
	const packs: LoadedStandardsLibrary[] = [{ name: 'acme', formatVersion: 1, rootPath: '/packages/acme', documents: [], rules }];
	const config = LightsoutConfig.parse({
		gates: { check: 'true', test: 'true', 'test-coverage': false },
		'standards-rule-settings': { 'folder-size': { options: { cap: 2 } } },
	});
	const states = resolvePackageRuleStates({ packs, config });

	return { cwd, packs, states, calls };
};

/** One live checked rule `acme/size` whose check writes its site keys with the short id, as every check does. */
const setupFullNameRun = () => {
	const { cwd } = setupRepo();
	const sizeRun: StandardsCheckFunction = () => [{ siteKey: 'size:src/alpha.ts', files: [{ path: 'src/alpha.ts' }], detail: 'too big' }];
	const packs: LoadedStandardsLibrary[] = [
		{
			name: 'acme',
			formatVersion: 1,
			rootPath: '/packages/acme',
			documents: [],
			rules: [rule({ id: 'size', name: 'acme/size', library: 'acme', inputKind: StandardsInputKind.FileText, run: sizeRun })],
		},
	];
	const states = new Map<string, ResolvedRuleState>([['acme/size', { severity: StandardsSeverity.Advisory, options: {}, fromConfig: false }]]);

	return { cwd, packs, states };
};

describe('runPackageChecks', () => {
	test('stamps each finding with the rule id it came from and the severity the repo resolved', async () => {
		const { cwd } = setupRepo();
		const calls: Array<{ input: StandardsCheckInput; options: Record<string, number> }> = [];

		const { findings } = await runChecks({
			cwd,
			rules: [
				rule({
					id: 'multi-export',
					inputKind: StandardsInputKind.FileText,
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

	test('builds one input per kind and hands the very same one to every rule that asked for it', async () => {
		const { cwd } = setupRepo();
		const calls: Array<{ input: StandardsCheckInput; options: Record<string, number> }> = [];

		await runChecks({
			cwd,
			rules: [
				rule({ id: 'first', inputKind: StandardsInputKind.FileText, run: recordingRun({ id: 'first', calls }) }),
				rule({ id: 'second', inputKind: StandardsInputKind.FileText, run: recordingRun({ id: 'second', calls }) }),
			],
		});

		expect(calls).toHaveLength(2);
		// one build, one read of every file, however many rules want the text
		expect(calls[0]?.input).toBe(calls[1]?.input);
	});

	test('gives each duplicate-block rule its own detection, because the detector runs on the options of that rule', async () => {
		const { cwd } = setupRepo();
		const calls: Array<{ input: StandardsCheckInput; options: Record<string, number> }> = [];

		await runChecks({
			cwd,
			rules: [
				rule({
					id: 'duplicate-code-block',
					inputKind: StandardsInputKind.CloneSpans,
					run: recordingRun({ id: 'duplicate-code-block', calls }),
					defaultOptions: { minTokens: 50 },
				}),
				rule({
					id: 'duplicate-code-block-strict',
					inputKind: StandardsInputKind.CloneSpans,
					run: recordingRun({ id: 'duplicate-code-block-strict', calls }),
					defaultOptions: { minTokens: 200 },
				}),
			],
		});

		expect(calls[0]?.input).not.toBe(calls[1]?.input);
		expect(calls[0]?.options).toStrictEqual({ minTokens: 50 });
		expect(calls[1]?.options).toStrictEqual({ minTokens: 200 });
	});

	test('runs nothing for a rule the repo switched off', async () => {
		const { cwd } = setupRepo();
		const calls: Array<{ input: StandardsCheckInput; options: Record<string, number> }> = [];

		const { findings } = await runChecks({
			cwd,
			rules: [rule({ id: 'multi-export', inputKind: StandardsInputKind.FileText, run: recordingRun({ id: 'multi-export', calls }) })],
			severities: { 'multi-export': StandardsSeverity.Off },
		});

		// off is a configuration state: the check is never even called
		expect(calls).toHaveLength(0);
		expect(findings).toStrictEqual([]);
	});

	test('ignores a judgment-only rule, which ships no check to run', async () => {
		const { cwd } = setupRepo();

		const { findings, notes } = await runChecks({ cwd, rules: [rule({ id: 'premature-abstraction' })] });

		expect(findings).toStrictEqual([]);
		expect(notes).toStrictEqual([]);
	});

	test('runs a framework rule only when its channel is active for the repo', async () => {
		const { cwd } = setupRepo();
		const calls: Array<{ input: StandardsCheckInput; options: Record<string, number> }> = [];
		const reactRule = rule({ id: 'hook-deps', channel: 'react', inputKind: StandardsInputKind.FileText, run: recordingRun({ id: 'hook-deps', calls }) });

		const inactive = await runChecks({ cwd, rules: [reactRule], channels: [] });
		const active = await runChecks({ cwd, rules: [reactRule], channels: ['react'] });

		// a document out of play contributes no prose, so it contributes no checks
		expect(inactive.findings).toStrictEqual([]);
		expect(active.findings).toHaveLength(1);
	});

	test('scopes the checked files to --path while keeping the whole repo as reference', async () => {
		const { cwd } = setupRepo();
		const calls: Array<{ input: StandardsCheckInput; options: Record<string, number> }> = [];

		await runChecks({
			cwd,
			rules: [rule({ id: 'multi-export', inputKind: StandardsInputKind.FileList, run: recordingRun({ id: 'multi-export', calls }) })],
			path: 'src/feature',
		});

		const input = fileListInput({ calls });

		expect(input.files).toStrictEqual(['src/feature/internal.ts']);
		// reference files stay unfiltered — a consumer outside the scope still counts
		expect(input.referenceFiles).toContain('src/alpha.ts');
	});

	test('drops the excluded paths a repo declared generated', async () => {
		const { cwd } = setupRepo();
		const calls: Array<{ input: StandardsCheckInput; options: Record<string, number> }> = [];

		await runChecks({
			cwd,
			rules: [rule({ id: 'multi-export', inputKind: StandardsInputKind.FileList, run: recordingRun({ id: 'multi-export', calls }) })],
			exclude: ['src/feature'],
		});

		expect(fileListInput({ calls }).referenceFiles).not.toContain('src/feature/internal.ts');
	});

	test('reports progress as the file count first and then each input kind it ran', async () => {
		const { cwd } = setupRepo();
		const calls: Array<{ input: StandardsCheckInput; options: Record<string, number> }> = [];
		const messages: string[] = [];

		await runChecks({
			cwd,
			rules: [rule({ id: 'multi-export', inputKind: StandardsInputKind.FileText, run: recordingRun({ id: 'multi-export', calls }) })],
			onProgress: (message) => messages.push(message),
		});

		expect(messages).toStrictEqual(['checking 2 source file(s) and 1 test file(s)', 'file-text: done']);
	});

	test('names the rule when its check returns something that is not a list of findings', async () => {
		const { cwd } = setupRepo();
		const brokenRun = (() => 'not findings at all') as unknown as StandardsCheckFunction;

		const error = await getRejectionError({
			promise: runChecks({ cwd, rules: [rule({ id: 'multi-export', inputKind: StandardsInputKind.FileText, run: brokenRun })] }),
		});

		// a broken check is a package bug, not a finding
		expect(error.message).toContain('standards rule "acme/multi-export" returned something that is not a list of findings');
	});

	test('names the offending field when a check returns a finding that is missing one', async () => {
		const { cwd } = setupRepo();
		const shortRun = (() => [{ siteKey: 'a-site', files: [{ path: 'src/alpha.ts' }] }]) as unknown as StandardsCheckFunction;

		const error = await getRejectionError({
			promise: runChecks({ cwd, rules: [rule({ id: 'multi-export', inputKind: StandardsInputKind.FileText, run: shortRun })] }),
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
			promise: runChecks({ cwd, rules: [rule({ id: 'multi-export', inputKind: StandardsInputKind.FileText, run: throwingRun })] }),
		});

		expect(error.message).toBe('standards rule "acme/multi-export" threw while checking: cannot parse that');
	});

	test('leaves a rule out when the run was handed no resolved state for it', async () => {
		const { cwd } = setupRepo();
		const calls: Array<{ input: StandardsCheckInput; options: Record<string, number> }> = [];
		const pkg: LoadedStandardsLibrary = {
			name: 'acme',
			formatVersion: 1,
			rootPath: '/packages/acme',
			documents: [],
			rules: [rule({ id: 'multi-export', inputKind: StandardsInputKind.FileText, run: recordingRun({ id: 'multi-export', calls }) })],
		};

		const { findings } = await runPackageChecks({ cwd, packs: [pkg], states: new Map(), channels: [] });

		// severity is policy; with none resolved there is nothing to report at
		expect(findings).toStrictEqual([]);
	});

	test('runs each live rule with its resolved options, the config override merged over its defaults', async () => {
		const { cwd, packs, states, calls } = setupConfiguredRun();

		await runPackageChecks({ cwd, packs, states, channels: [] });

		expect(calls).toStrictEqual({ 'folder-size': { cap: 2 }, 'file-size': { file: 250, tsxFile: 300 } });
	});

	test('findings carry the full rule name and a site key prefixed with it', async () => {
		const { cwd, packs, states } = setupFullNameRun();

		const { findings } = await runPackageChecks({ cwd, packs, states, channels: [] });

		expect(findings).toStrictEqual([
			{ rule: 'acme/size', severity: StandardsSeverity.Advisory, siteKey: 'acme/size:src/alpha.ts', files: [{ path: 'src/alpha.ts' }], detail: 'too big' },
		]);
	});
});
