import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { checkLintRules } from '#src/doctor/runDoctor/checkLintRules.ts';

/** A config that names no standards key at all, so no package gets standards. */
const unsetConfig: LightsoutConfig = { gates: { check: 'true', test: 'true', 'test-coverage': false } };

/** Standards are opt-in, so the config every check below runs under names a pack. */
const config: LightsoutConfig = { ...unsetConfig, 'standards-pack': 'lightsout/standards' };

/** A package directory holding the given lint config files. */
const setupPackage = ({ files = {} }: { files?: Record<string, string> } = {}) => {
	const dir = mkdtempSync(join(tmpdir(), 'lightsout-lint-rules-'));

	for (const [name, content] of Object.entries(files)) {
		writeFileSync(join(dir, name), content);
	}

	return { packageDirs: [{ label: 'api', dir }], dir };
};

describe('checkLintRules', () => {
	test('says nothing when the consumer has turned standards off', async () => {
		const { packageDirs } = setupPackage({ files: { 'biome.json': '{}' } });

		// no standards means no mechanical rules to enforce them
		expect(await checkLintRules({ config: { ...config, 'standards-pack': false }, packageDirs })).toBe(undefined);
	});

	test('checkLintRules: an unset standards-pack skips the check, and a named one runs it', async () => {
		const { packageDirs } = setupPackage({ files: { 'biome.json': '{}' } });

		const skipped = await checkLintRules({ config: unsetConfig, packageDirs });
		const ran = await checkLintRules({ config, packageDirs });

		// standards are opt-in: naming no standards key selects no pack, so there is nothing for a linter to enforce
		expect({ skipped, ranId: ran?.id, ranStatus: ran?.status }).toStrictEqual({ skipped: undefined, ranId: 'lint-rules', ranStatus: 'note' });
	});

	test('still checks lint rules when standards-pack is false but package-standards-packs names a package', async () => {
		const { packageDirs } = setupPackage({ files: { 'biome.json': '{}' } });

		const named = await checkLintRules({
			config: { ...config, 'standards-pack': false, 'package-standards-packs': { 'web-app': 'lightsout/fractal' } },
			packageDirs,
		});
		const unnamed = await checkLintRules({ config: { ...config, 'standards-pack': false }, packageDirs });

		// a package the map names still gets standards, so its lint gap still matters
		expect({ namedId: named?.id, namedStatus: named?.status, unnamed }).toStrictEqual({
			namedId: 'lint-rules',
			namedStatus: 'note',
			unnamed: undefined,
		});
	});

	test('flags a biome config that does not enforce the rules the standards assume', async () => {
		const { packageDirs } = setupPackage({ files: { 'biome.json': '{ "linter": {} }' } });

		const check = await checkLintRules({ config, packageDirs });

		expect(check?.status).toBe('note');
		expect(check?.detail ?? '').toMatch(/useImportType, noExplicitAny missing or disabled/);
	});

	test('treats a rule explicitly turned off the same as a missing one', async () => {
		const { packageDirs } = setupPackage({ files: { 'biome.json': '{ "useImportType": "off", "noExplicitAny": "error" }' } });

		const check = await checkLintRules({ config, packageDirs });

		// a rule set to off is not enforcement, however present its name is
		expect(check?.detail ?? '').toMatch(/useImportType/);
		expect(check?.detail ?? '').not.toMatch(/noExplicitAny/);
	});

	test('passes an eslint config that names both rules', async () => {
		const { packageDirs } = setupPackage({
			files: { 'eslint.config.js': "export default [{ rules: { 'consistent-type-imports': 'error', 'no-explicit-any': 'error' } }];" },
		});

		const check = await checkLintRules({ config, packageDirs });

		expect(check?.status).toBe('pass');
		// one file found means one config counted, not one per rule it enforces
		expect(check?.detail ?? '').toMatch(/1 lint config/);
	});

	test('a package directory that is not there contributes nothing rather than failing the doctor', async () => {
		// the doctor is a diagnosis, so a directory that vanished under it holds no
		// lint config to read, never a crash
		const check = await checkLintRules({ config, packageDirs: [{ label: 'ghost', dir: '/lightsout/no/such/package' }] });

		expect(check?.status).toBe('note');
		expect(check?.detail ?? '').toMatch(/no linter config found/);
	});

	test('an unreadable lint config is treated as enforcing nothing', async () => {
		const { packageDirs, dir } = setupPackage();

		// a directory where the file should be: readable as an entry, not as text
		mkdirSync(join(dir, 'biome.json'));

		const check = await checkLintRules({ config, packageDirs });

		expect(check?.detail ?? '').toMatch(/useImportType, noExplicitAny missing or disabled/);
	});

	test('recognises a legacy .eslintrc as a lint config too', async () => {
		const { packageDirs } = setupPackage({ files: { '.eslintrc.json': '{ "rules": {} }' } });

		const check = await checkLintRules({ config, packageDirs });

		// an older config still governs the repo, so it is still held to the rules
		expect(check?.detail ?? '').toMatch(/consistent-type-imports, no-explicit-any missing or disabled/);
	});
});
