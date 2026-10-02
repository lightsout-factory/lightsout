import { describe, expect, test } from '@jest/globals';
import { selectsNoStandards } from '#src/common/config/selectsNoStandards.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';

interface StandardsCase {
	label: string;
	/** The standards keys the config holds beside its gates; undefined for a repo with no config at all. */
	standards: Partial<LightsoutConfig> | undefined;
}

const setupConfig = ({ standards }: { standards: Partial<LightsoutConfig> | undefined }): { config: LightsoutConfig | undefined } => ({
	config: standards === undefined ? undefined : { gates: { check: 'true', test: 'true', 'test-coverage': false }, ...standards },
});

describe('selectsNoStandards', () => {
	test.each<StandardsCase>([
		{ label: 'a repo with no config', standards: undefined },
		{ label: 'an unset standards-pack', standards: {} },
		{ label: 'standards-pack false', standards: { 'standards-pack': false } },
		{ label: 'standards-pack false beside an empty package-standards-packs', standards: { 'standards-pack': false, 'package-standards-packs': {} } },
		{ label: 'rule settings with no pack to apply them to', standards: { 'standards-rule-settings': { 'file-size': 'blocking' } } },
	])('selects none for $label', ({ standards }) => {
		const { config } = setupConfig({ standards });

		const selectsNone = selectsNoStandards({ config });

		expect(selectsNone).toBe(true);
	});

	test.each<StandardsCase>([
		{ label: 'a named standards-pack', standards: { 'standards-pack': 'lightsout/node' } },
		{ label: 'a standards-pack list', standards: { 'standards-pack': ['lightsout/node', 'lightsout/react'] } },
		{ label: 'a package entry with standards-pack unset', standards: { 'package-standards-packs': { 'web-app': 'lightsout/react-app' } } },
		{
			label: 'a package entry with standards-pack false',
			standards: { 'standards-pack': false, 'package-standards-packs': { 'web-app': 'lightsout/react-app' } },
		},
	])('keeps standards on for $label', ({ standards }) => {
		const { config } = setupConfig({ standards });

		const selectsNone = selectsNoStandards({ config });

		expect(selectsNone).toBe(false);
	});
});
