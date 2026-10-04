import { describe, expect, jest, test } from '@jest/globals';
import { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import type { StandardsFinding } from '#src/contracts/standardsCheck/StandardsFinding.ts';
import { buildWorklist } from '#src/refactor/runRefactorPipeline/initializeRun/buildWorklist.ts';

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

const mockRunStandardsCheck = jest.fn<(params: StandardsCheckParams) => Promise<{ findings: StandardsFinding[]; notes: string[] }>>();

jest.mock('#src/standardsCheck/runStandardsCheck.ts', () => ({
	runStandardsCheck: (params: StandardsCheckParams) => mockRunStandardsCheck(params),
}));
// -------------------------

const setupWorklist = () => {
	mockRunStandardsCheck.mockResolvedValue({ findings: [], notes: [] });

	const config = LightsoutConfig.parse({ gates: { check: 'true', test: 'true', 'test-coverage': false }, 'packages-dir': 'modules' });

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
});
