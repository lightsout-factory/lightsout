import { expect, test } from '@jest/globals';
import { runCli } from '#tests/helpers/runCli.ts';
import { seedRunFixture } from '#tests/helpers/seedRunFixture.ts';
import { usageStderr } from '#tests/helpers/usageStderr.ts';

// A repo holding one real run, so the id the test types is the only thing
// that fails to resolve — never a missing runs folder.
const setupStopRepo = async () => {
	const { cwd } = await seedRunFixture({ status: 'running' });

	return { cwd };
};

test('cli: stop is dispatched and names an unknown run id rather than printing usage', async () => {
	const { cwd } = await setupStopRepo();

	const { stdout, stderr, code } = await runCli({ args: ['stop', '--run', 'ghost', '--cwd', cwd] });

	expect({ stdout, stderrIsUsage: stderr === usageStderr, code }).toStrictEqual({ stdout: '', stderrIsUsage: false, code: 1 });
	expect(stderr).toMatch(/no run matching 'ghost'/);
	expect(stderr).not.toMatch(/\n\s+at /);
});
