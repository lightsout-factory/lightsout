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
		standardsPacks: [],
	};
	const options = { cap: 2 };
	const finding: RawStandardsFinding = { siteKey: 'folder-size:src', files: [{ path: 'src/a.ts' }], detail: 'src holds 3 files' };
	const run = jest
		.fn<StandardsCheckFunction>()
		.mockReturnValueOnce(Promise.resolve([finding]))
		.mockReturnValueOnce(Promise.resolve({ findings: 'none' } as unknown as RawStandardsFinding[]));

	return { input, options, finding, run };
};

describe('runRuleCheck', () => {
	test('hands the check its input and options, and names the rule when the return is not a finding list', async () => {
		const { input, options, finding, run } = setupCheck();

		const findings = await runRuleCheck({ rule: 'folder-size', run, input, options });

		expect({ calls: run.mock.calls, findings }).toStrictEqual({ calls: [[{ input, options }]], findings: [finding] });
		await expect(runRuleCheck({ rule: 'folder-size', run, input, options })).rejects.toThrow(/"folder-size".*not a list of findings/);
	});
});
