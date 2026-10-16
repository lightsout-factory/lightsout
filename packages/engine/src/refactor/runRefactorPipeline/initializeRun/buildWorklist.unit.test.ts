import { describe, expect, jest, test } from '@jest/globals';
import { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import type { StandardsFinding } from '#src/contracts/standardsCheck/StandardsFinding.ts';
import { buildWorklist } from '#src/refactor/runRefactorPipeline/initializeRun/buildWorklist.ts';
import { sourceFileGlobs } from '#tests/helpers/sourceFileGlobs.ts';
import { testFileGlobs } from '#tests/helpers/testFileGlobs.ts';

// Mocked Imports
// -------------------------
interface StandardsCheckParams {
	cwd: string;
	config: LightsoutConfig | undefined;
	path?: string;
	all?: boolean;
	writeBaseline?: boolean;
	persist?: boolean;
	onProgress?: (message: string) => void;
}

const mockRunStandardsCheck = jest.fn<(params: StandardsCheckParams) => Promise<{ findings: StandardsFinding[]; notes: string[]; ruleOrder: string[] }>>();

jest.mock('#src/standardsCheck/runStandardsCheck/runStandardsCheck.ts', () => ({
	runStandardsCheck: (params: StandardsCheckParams) => mockRunStandardsCheck(params),
}));
// -------------------------

const setupWorklist = () => {
	mockRunStandardsCheck.mockResolvedValue({ findings: [], notes: [], ruleOrder: [] });

	const config = LightsoutConfig.parse({
		'source-files': sourceFileGlobs,
		'test-files': testFileGlobs,
		gates: { check: 'true', test: 'true', 'test-coverage': false },
		'packages-dir': 'modules',
	});

	return { config };
};

describe('buildWorklist', () => {
	test('checks its scope with the config it was given', async () => {
		const { config } = setupWorklist();

		await buildWorklist({ cwd: '/repo', config, path: 'src/core', all: true });

		const params = mockRunStandardsCheck.mock.calls[0]?.[0];
		expect({ params, sameConfig: params?.config === config }).toStrictEqual({
			params: { cwd: '/repo', config, path: 'src/core', all: true, persist: false },
			sameConfig: true,
		});
	});

	test('batches its blocking findings in the rule order the check hands back', async () => {
		const { config } = setupWorklist();
		const finding = ({ rule }: { rule: string }): StandardsFinding => ({
			rule,
			severity: 'blocking',
			siteKey: `${rule}:src/a.ts`,
			files: [{ path: 'src/a.ts' }],
			detail: 'stub',
		});

		mockRunStandardsCheck.mockResolvedValue({
			findings: [finding({ rule: 'acme/early' }), finding({ rule: 'acme/late' })],
			notes: [],
			ruleOrder: ['acme/late', 'acme/early'],
		});

		const worklist = await buildWorklist({ cwd: '/repo', config });

		expect(worklist.batches.map((batch) => batch.rule)).toStrictEqual(['acme/late', 'acme/early']);
	});
});
