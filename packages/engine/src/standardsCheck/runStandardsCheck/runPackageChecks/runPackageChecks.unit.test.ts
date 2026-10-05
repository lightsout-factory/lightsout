import { describe, expect, test } from '@jest/globals';
import { type FileListInput, type StandardsCheckFunction, type StandardsCheckInputs, StandardsInputKind } from '@lightsout/standards-contracts';
import type { ResolvedRuleState } from '#src/common/types/ResolvedRuleState.ts';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import { runPackageChecks } from '#src/standardsCheck/runStandardsCheck/runPackageChecks/runPackageChecks.ts';
import { getRejectionError } from '#tests/helpers/getRejectionError.ts';
import { packageChecksFixtures } from '#tests/helpers/packageChecksFixtures.ts';

const { setupRepo, rule, recordingRun, groupOf, runChecks } = packageChecksFixtures;

/** The first input a check was handed, narrowed to the kind whose path lists the test reads. */
const fileListInput = ({ calls }: { calls: Array<{ inputs: StandardsCheckInputs }> }): FileListInput => {
	const input = calls[0]?.inputs[StandardsInputKind.FileList];

	if (input === undefined) {
		throw new Error(`expected a file-list input, got ${Object.keys(calls[0]?.inputs ?? {}).join(',') || 'none'}`);
	}

	return input;
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

	test('findings carry the full rule name and a site key prefixed with it', async () => {
		const { cwd, groups } = setupFullNameRun();

		const { findings } = await runPackageChecks({ cwd, groups });

		expect(findings).toStrictEqual([
			{ rule: 'acme/size', severity: StandardsSeverity.Advisory, siteKey: 'acme/size:src/alpha.ts', files: [{ path: 'src/alpha.ts' }], detail: 'too big' },
		]);
	});
});
