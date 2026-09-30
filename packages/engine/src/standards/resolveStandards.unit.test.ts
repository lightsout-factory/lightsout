import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';
import { resolveStandards } from '#src/standards/resolveStandards.ts';
import { getRejectionError } from '#tests/helpers/getRejectionError.ts';

const baseConfig: LightsoutConfig = { gates: { check: 'true', test: 'true', 'test-coverage': false } };

/** A temp consumer repo holding the given repo-relative files. */
const setupRepo = ({ files = {} }: { files?: Record<string, string> } = {}) => {
	const cwd = mkdtempSync(join(tmpdir(), 'lightsout-resolve-standards-'));

	for (const [path, content] of Object.entries(files)) {
		const absolutePath = join(cwd, path);

		mkdirSync(dirname(absolutePath), { recursive: true });
		writeFileSync(absolutePath, content);
	}

	return { cwd };
};

/** One rule folder's files: its markdown plus the fixture pair every rule ships. */
const ruleFiles = ({ path, summary }: { path: string; summary: string }) => ({
	[`${path}/rule.md`]: `---\nsummary: ${summary}\n---\n\n${summary} — the rule's prose.\n`,
	[`${path}/fixtures/pass/src/example.ts`]: 'export const example = 1;\n',
	[`${path}/fixtures/fail/src/example.ts`]: 'export const example = 2;\n',
});

/**
 * A standards library under `at` in the consumer repo, carrying one topic per
 * set and a `<name>/<name>` pack that includes both — enough to tell the two
 * sets apart. Rule ids carry the library name so two of these can be
 * registered side by side.
 */
const packageFiles = ({ at, name }: { at: string; name: string }) => ({
	[`${at}/lightsout-standards.json`]: `{ "name": "${name}", "formatVersion": 2 }\n`,
	[`${at}/rules/code/house-style/topic.md`]: `# ${name} code\n\nHow this house writes code.\n`,
	...ruleFiles({ path: `${at}/rules/code/house-style/01-${name}-tabs`, summary: 'indent with tabs' }),
	[`${at}/rules/tests/house-tests/topic.md`]: `# ${name} tests\n\nHow this house writes tests.\n`,
	...ruleFiles({ path: `${at}/rules/tests/house-tests/01-${name}-one-assert`, summary: 'one behaviour per test' }),
	[`${at}/packs/${name}.json`]: JSON.stringify({
		description: `The ${name} pack.`,
		include: { topics: [`${name}/code/house-style`, `${name}/tests/house-tests`] },
	}),
});

/**
 * A standards library under `at` carrying a code set and no tests set at all —
 * a library is free to ship one set, and the assembly has to notice the gap
 * rather than paper over it. Its `<name>/<name>` pack includes the code topic.
 */
const codeOnlyPackageFiles = ({ at, name }: { at: string; name: string }) => ({
	[`${at}/lightsout-standards.json`]: `{ "name": "${name}", "formatVersion": 2 }\n`,
	[`${at}/rules/code/${name}-style/topic.md`]: `# ${name} code\n\nHow this house lints.\n`,
	...ruleFiles({ path: `${at}/rules/code/${name}-style/01-${name}-no-any`, summary: 'never write any' }),
	[`${at}/packs/${name}.json`]: JSON.stringify({ description: `The ${name} pack.`, include: { topics: [`${name}/code/${name}-style`] } }),
});

describe('resolveStandards', () => {
	test('resolveStandards: the prose comes from the selected pack, detected or named', async () => {
		const { cwd } = setupRepo({ files: { 'package.json': JSON.stringify({ name: 'app', dependencies: { react: '^19.0.0' } }) } });
		const namedConfig: LightsoutConfig = { ...baseConfig, 'standards-pack': 'lightsout/node' };

		const detected = await resolveStandards({ cwd, config: baseConfig });
		const named = await resolveStandards({ cwd, config: namedConfig });

		// react in the root manifest selects lightsout/react-app, which carries the react architecture topic
		expect(detected.standards ?? '').toContain('<!-- lightsout: code/architecture/react -->');
		expect({ pack: detected.groups[0]?.pack.name, source: detected.groups[0]?.source }).toStrictEqual({
			pack: 'lightsout/react-app',
			source: 'detected',
		});
		// the named node pack wins over detection and leaves the react topic out
		expect(named.standards ?? '').not.toContain('code/architecture/react');
	});

	test('resolveStandards: standards-pack false yields no prose and no group', async () => {
		const { cwd } = setupRepo();
		const config: LightsoutConfig = { ...baseConfig, 'standards-pack': false };

		const resolved = await resolveStandards({ cwd, config });

		expect({ standards: resolved.standards, testStandards: resolved.testStandards, groups: resolved.groups }).toStrictEqual({
			standards: undefined,
			testStandards: undefined,
			groups: [],
		});
	});

	test('loads the package the plugin ships when the consumer specifies nothing', async () => {
		const { cwd } = setupRepo();

		const resolved = await resolveStandards({ cwd, config: baseConfig });

		expect(resolved.standards).toContain('<!-- lightsout: code/');
		expect(resolved.testStandards).toContain('<!-- lightsout: tests/');
		// unspecified is a real request for the defaults: the pack detection picks for a repo with no manifest
		expect(resolved.groups.map((group) => ({ pack: group.pack.name, source: group.source }))).toStrictEqual([{ pack: 'lightsout/node', source: 'detected' }]);
	});

	test('loads nothing when standards packs are explicitly disabled', async () => {
		const { cwd } = setupRepo();
		const config: LightsoutConfig = { ...baseConfig, 'standards-pack': false };

		const resolved = await resolveStandards({ cwd, config });

		expect(resolved.standards).toBe(undefined);
		expect(resolved.testStandards).toBe(undefined);
		// nothing was asked for, so there is no pack to name
		expect(resolved.groups).toStrictEqual([]);
	});

	test('assembles both sets from exactly the package the consumer declared', async () => {
		const { cwd } = setupRepo({ files: packageFiles({ at: 'standards/house', name: 'house' }) });
		const config: LightsoutConfig = { ...baseConfig, 'standards-libraries': { house: './standards/house' }, 'standards-pack': 'house/house' };

		const resolved = await resolveStandards({ cwd, config });

		// the declared pack replaces the bundled default rather than stacking under it
		expect(resolved.standards).toBe("<!-- house: code/house-style -->\n# house code\n\nHow this house writes code.\n\nindent with tabs — the rule's prose.");
		expect(resolved.testStandards).toBe(
			"<!-- house: tests/house-tests -->\n# house tests\n\nHow this house writes tests.\n\none behaviour per test — the rule's prose.",
		);
	});

	test('a package carrying one set leaves the other set out of the stack rather than gapping it', async () => {
		const { cwd } = setupRepo({
			files: {
				...packageFiles({ at: 'standards/house', name: 'house' }),
				...codeOnlyPackageFiles({ at: 'standards/lint', name: 'lint' }),
				// one pack combining both libraries' topics
				'standards/house/packs/combined.json': JSON.stringify({
					description: 'The house pack with the lint topic.',
					include: { packs: ['house/house'], topics: ['lint/code/lint-style'] },
				}),
			},
		});
		const config: LightsoutConfig = {
			...baseConfig,
			'standards-libraries': { house: './standards/house', lint: './standards/lint' },
			'standards-pack': 'house/combined',
		};

		const resolved = await resolveStandards({ cwd, config });

		expect(resolved.standards ?? '').toContain('<!-- lint: code/lint-style -->');
		// the tests set is the one library that carries it, with no separator left where the other would have gone
		expect(resolved.testStandards).toBe(
			"<!-- house: tests/house-tests -->\n# house tests\n\nHow this house writes tests.\n\none behaviour per test — the rule's prose.",
		);
	});

	test('a set no loaded package carries is absent even though standards were asked for', async () => {
		const { cwd } = setupRepo({ files: codeOnlyPackageFiles({ at: 'standards/lint', name: 'lint' }) });
		const config: LightsoutConfig = { ...baseConfig, 'standards-libraries': { lint: './standards/lint' }, 'standards-pack': 'lint/lint' };

		const resolved = await resolveStandards({ cwd, config });

		expect(resolved.standards ?? '').toContain('<!-- lint: code/lint-style -->');
		expect(resolved.testStandards).toBe(undefined);
		// a pack did load, so the caller still names it
		expect(resolved.groups.map((group) => group.pack.name)).toStrictEqual(['lint/lint']);
	});

	test('a declared package that does not exist is a hard error rather than a silent skip', async () => {
		const { cwd } = setupRepo();
		const config: LightsoutConfig = { ...baseConfig, 'standards-pack': 'lightsout/ghost' };

		const error = await getRejectionError({ promise: resolveStandards({ cwd, config }) });

		expect(error.message).toContain('pack lightsout/ghost: names no pack');
	});
});
