import { describe, expect, jest, test } from '@jest/globals';
import { type RawStandardsFinding, type StandardsCheckFunction, type StandardsCheckInputs, StandardsInputKind } from '@lightsout/standards-contracts';
import { runRuleCheck } from '#src/standardsCheck/internal/common/utils/runRuleCheck.ts';

/** A check that answers its first call with a finding list and its second with something that is not one. */
const setupCheck = () => {
	const inputs: StandardsCheckInputs = {
		[StandardsInputKind.FileList]: {
			kind: StandardsInputKind.FileList,
			cwd: '/repo',
			source: ['src/a.ts'],
			tests: [],
			files: ['src/a.ts'],
			referenceFiles: [],
			dependencies: new Map(),
			standardsLibraries: [],
		},
	};
	const options = { cap: 2 };
	const finding: RawStandardsFinding = { siteKey: 'folder-size:src', files: [{ path: 'src/a.ts' }], detail: 'src holds 3 files' };
	const run = jest
		.fn<StandardsCheckFunction>()
		.mockReturnValueOnce(Promise.resolve([finding]))
		.mockReturnValueOnce(Promise.resolve({ findings: 'none' } as unknown as RawStandardsFinding[]));

	return { inputs, options, finding, run };
};

/** A check for the rule `acme/size` that returns one fully populated finding under the given site key. */
const setupSiteKeyCheck = ({ siteKey }: { siteKey: string }) => {
	const rule = { id: 'size', name: 'acme/size' };
	const inputs: StandardsCheckInputs = {
		[StandardsInputKind.FileList]: {
			kind: StandardsInputKind.FileList,
			cwd: '/repo',
			source: ['src/a.ts'],
			tests: [],
			files: ['src/a.ts'],
			referenceFiles: [],
			dependencies: new Map(),
			standardsLibraries: [],
		},
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

	return { rule, inputs, options, run };
};

describe('runRuleCheck', () => {
	test('hands the check its inputs and options, and names the rule when the return is not a finding list', async () => {
		const { inputs, options, finding, run } = setupCheck();

		const rule = { id: 'folder-size', name: 'lightsout/folder-size' };

		const findings = await runRuleCheck({ rule, run, inputs, options });

		expect({ calls: run.mock.calls, findings }).toStrictEqual({
			calls: [[{ inputs, options }]],
			findings: [{ ...finding, siteKey: 'lightsout/folder-size:src' }],
		});
		await expect(runRuleCheck({ rule, run, inputs, options })).rejects.toThrow(/"lightsout\/folder-size".*not a list of findings/);
	});

	test('a site key starting with the rule id is rewritten to start with the full name', async () => {
		const { rule, inputs, options, run } = setupSiteKeyCheck({ siteKey: 'size:src/a.ts' });

		const findings = await runRuleCheck({ rule, run, inputs, options });

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
		const { rule, inputs, options, run } = setupSiteKeyCheck({ siteKey: 'sizes:src/a.ts' });

		await expect(runRuleCheck({ rule, run, inputs, options })).rejects.toThrow(/acme\/size[\s\S]*sizes:src\/a\.ts|sizes:src\/a\.ts[\s\S]*acme\/size/);
	});
});
