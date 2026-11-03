import { expect, jest, test } from '@jest/globals';
import { printHarnessLine } from '#src/cli/common/render/printHarnessLine.ts';
import type { Driver } from '#src/common/types/Driver.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { sourceFileGlobs } from '#tests/helpers/sourceFileGlobs.ts';
import { testFileGlobs } from '#tests/helpers/testFileGlobs.ts';

// The line IS the output, so capturing console.log is the arrangement.
const captureLogged = () => {
	const logged: string[] = [];

	jest.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
		logged.push(String(args[0]));
	});

	return { logged };
};

const driver: Driver = { name: 'omp', invoke: async () => ({ text: '', exitCode: 0 }) };

test('printHarnessLine: names the resolved harness, model, effort and permissions', () => {
	const { logged } = captureLogged();
	const config: LightsoutConfig = {
		harness: 'omp',
		model: 'glm-5.3-flash',
		effort: 'low',
		permissions: 'full-access',
		'source-files': sourceFileGlobs,
		'test-files': testFileGlobs,
		gates: { check: 'c', test: 't', 'test-coverage': false },
	};

	printHarnessLine({ driver, config });

	expect(logged).toStrictEqual(['  harness: omp · model: glm-5.3-flash · effort: low · permissions: full-access']);
});

test('printHarnessLine: with no config, says the harness runs on its own defaults rather than printing nothing', () => {
	const { logged } = captureLogged();

	printHarnessLine({ driver, config: undefined });

	expect(logged).toStrictEqual(['  harness: omp · model: harness default · effort: harness default · permissions: write']);
});
