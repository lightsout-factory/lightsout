import { describe, expect, test } from '@jest/globals';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { checkStandardsPack } from '#src/doctor/checkStandardsPack.ts';

/** A config naming whichever repo pack and package packs the case gives. */
const setupConfig = ({
	standardsPack,
	packagePacks,
}: {
	standardsPack?: string | string[] | false;
	packagePacks?: Record<string, string>;
} = {}): LightsoutConfig => ({
	gates: { check: 'true', test: 'true', 'test-coverage': false },
	'standards-pack': standardsPack,
	'package-standards-packs': packagePacks,
});

describe('checkStandardsPack', () => {
	test('notes that no standards run when nothing names a pack, and names the key that turns them on', () => {
		const config = setupConfig();

		const check = checkStandardsPack({ config });

		// a note, never a warning: running without standards is a legitimate choice
		expect(check).toEqual({
			id: 'standards-pack',
			status: 'note',
			detail: expect.stringMatching(/no `standards-pack` is set.*Set `"standards-pack"` to a pack address/),
		});
	});

	test.each([
		{ standardsPack: 'lightsout/standards', packagePacks: undefined },
		{ standardsPack: ['lightsout/fractal', 'lightsout/agent-corrections'], packagePacks: undefined },
		{ standardsPack: false as const, packagePacks: undefined },
		{ standardsPack: undefined, packagePacks: { engine: 'lightsout/fractal' } },
	])('stays silent when the repo chose its standards, turned them off, or a package names its own', ({ standardsPack, packagePacks }) => {
		const config = setupConfig({ standardsPack, packagePacks });

		const check = checkStandardsPack({ config });

		// an explicit choice, on or off, needs no line
		expect(check).toBe(undefined);
	});
});
