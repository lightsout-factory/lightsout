import { describe, expect, jest, test } from '@jest/globals';
import { type RawStandardsFinding, type StandardsCheckFunction, type StandardsCheckInput, StandardsInputKind } from '@lightsout/standards-contracts';
import { runRuleCheck } from '#src/standardsCheck/internal/common/utils/runRuleCheck.ts';

/** A check that answers its first call with a finding list and its second with something that is not one. */
const setupCheck = () => {
	const input: StandardsCheckInput = {
		kind: StandardsInputKind.FileList,
		cwd: '/repo',
		source: ['src/a.ts'],
		tests: [],
		files: ['src/a.ts'],
		referenceFiles: [],
		dependencies: new Map(),
		standardsLibraries: [],
	};
	const options = { cap: 2 };
	const finding: RawStandardsFinding = { siteKey: 'folder-size:src', files: [{ path: 'src/a.ts' }], detail: 'src holds 3 files' };
	const run = jest
		.fn<StandardsCheckFunction>()
		.mockReturnValueOnce(Promise.resolve([finding]))
		.mockReturnValueOnce(Promise.resolve({ findings: 'none' } as unknown as RawStandardsFinding[]));

	return { input, options, finding, run };
};

/** A check for the rule `acme/size` that returns one fully populated finding under the given site key. */
const setupSiteKeyCheck = ({ siteKey }: { siteKey: string }) => {
	const rule = { id: 'size', name: 'acme/size' };
	const input: StandardsCheckInput = {
		kind: StandardsInputKind.FileList,
		cwd: '/repo',
		source: ['src/a.ts'],
		tests: [],
		files: ['src/a.ts'],
		referenceFiles: [],
		dependencies: new Map(),
		standardsLibraries: [],
	};
	const options = { cap: 2 };
	const finding: RawStandardsFinding = {
		siteKey,
		files: [{ path: 'src/a.ts', startLine: 1, endLine: 40 }],
		detail: 'src/a.ts is 40 lines',
		guidance: 'split the file',
		measure: 40,
	};
	const run = jest.fn<StandardsCheckFunction>().mockReturnValue(Promise.resolve([finding]));

	return { rule, input, options, run };
};

describe('runRuleCheck', () => {
	test('hands the check its input and options, and names the rule when the return is not a finding list', async () => {
		const { input, options, finding, run } = setupCheck();

		const rule = { id: 'folder-size', name: 'lightsout/folder-size' };

		const findings = await runRuleCheck({ rule, run, input, options });

		expect({ calls: run.mock.calls, findings }).toStrictEqual({
			calls: [[{ input, options }]],
			findings: [{ ...finding, siteKey: 'lightsout/folder-size:src' }],
		});
		await expect(runRuleCheck({ rule, run, input, options })).rejects.toThrow(/"lightsout\/folder-size".*not a list of findings/);
	});

	test('a site key starting with the rule id is rewritten to start with the full name', async () => {
		const { rule, input, options, run } = setupSiteKeyCheck({ siteKey: 'size:src/a.ts' });

		const findings = await runRuleCheck({ rule, run, input, options });

		expect(findings).toStrictEqual([
			{
				siteKey: 'acme/size:src/a.ts',
				files: [{ path: 'src/a.ts', startLine: 1, endLine: 40 }],
				detail: 'src/a.ts is 40 lines',
				guidance: 'split the file',
				measure: 40,
			},
		]);
	});

	test('a site key not starting with the rule id throws naming the rule and the key', async () => {
		const { rule, input, options, run } = setupSiteKeyCheck({ siteKey: 'sizes:src/a.ts' });

		await expect(runRuleCheck({ rule, run, input, options })).rejects.toThrow(/acme\/size[\s\S]*sizes:src\/a\.ts|sizes:src\/a\.ts[\s\S]*acme\/size/);
	});
});
