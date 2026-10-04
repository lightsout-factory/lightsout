import { describe, expect, test } from '@jest/globals';
import { type StandardsCheckFunction, type StandardsCheckInputs, StandardsInputKind } from '@lightsout/standards-contracts';
import type { LoadedStandardsTopic } from '#src/common/types/LoadedStandardsTopic.ts';
import type { ResolvedRuleState } from '#src/common/types/ResolvedRuleState.ts';
import type { StandardsGroup } from '#src/common/types/StandardsGroup.ts';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import { runPackageChecks } from '#src/standardsCheck/runStandardsCheck/runPackageChecks/runPackageChecks.ts';
import { packageChecksFixtures } from '#tests/helpers/packageChecksFixtures.ts';

const { setupRepo, rule, recordingRun, groupOf, runChecks } = packageChecksFixtures;

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
