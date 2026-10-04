import { describe, expect, test } from '@jest/globals';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { checkGenerateCommand } from '#src/doctor/runDoctor/checkGenerateCommand.ts';

/** A config listing whichever `generated` paths and `gates.generate` command the case names. */
const setupConfig = ({ generated, generate }: { generated?: string[]; generate?: string } = {}): LightsoutConfig => ({
	gates: { check: 'true', test: 'true', 'test-coverage': false, generate },
	generated,
});

describe('checkGenerateCommand', () => {
	test('warns when generated paths are configured with no generate command, naming the count and the key to set', () => {
		const config = setupConfig({ generated: ['dist/', 'src/gen/'] });

		const check = checkGenerateCommand({ config });

		// advice for phased plans, never a failure
		expect(check).toEqual({
			id: 'generate-command',
			status: 'warn',
			detail: expect.stringMatching(/2 path\(s\).*`gates\.generate`/),
			fix: expect.stringContaining('`gates.generate`'),
		});
	});

	test.each([
		{ generated: ['dist/'], generate: 'pnpm build' },
		{ generated: undefined, generate: undefined },
		{ generated: [], generate: undefined },
	])('stays silent when a generate command is set or no generated paths are listed', ({ generated, generate }) => {
		const config = setupConfig({ generated, generate });

		const check = checkGenerateCommand({ config });

		// nothing to advise means no line at all, not an empty pass
		expect(check).toBe(undefined);
	});
});
