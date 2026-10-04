import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, jest, test } from '@jest/globals';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { resolveStandardsLibraries } from '#src/standardsLibraries/resolveStandardsLibraries.ts';
import { getRejectionError } from '#tests/helpers/getRejectionError.ts';

const baseConfig: LightsoutConfig = { gates: { check: 'true', test: 'true', 'test-coverage': false } };

interface LibrarySpec {
	/** Repo-relative folder the library is written under. */
	at: string;
	/** The manifest name. */
	name: string;
	/** The one rule's folder name, `<NN>-<rule-id>`. */
	ruleFolder: string;
	/** The rule.md requires entries, written as a block list; none when absent. */
	requires?: string[];
}

/** A one-rule standards library written under `at`. */
const writeLibrary = ({ cwd, at, name, ruleFolder, requires }: LibrarySpec & { cwd: string }) => {
	const libraryPath = join(cwd, at);
	const rulePath = `rules/code/demo/${ruleFolder}`;
	const requiresLines = requires === undefined ? '' : `requires:\n${requires.map((entry) => `  - ${entry}\n`).join('')}`;
	const files: Record<string, string> = {
		'lightsout-standards.json': `{ "name": "${name}", "formatVersion": 2 }\n`,
		'rules/code/demo/topic.md': '# Demo\n\nThe topic the rule argues under.\n',
		[`${rulePath}/rule.md`]: `---\nsummary: a rule the library declares\nchecks: agent\n${requiresLines}---\n\nThe rule prose.\n`,
		[`${rulePath}/fixtures/pass/src/example.ts`]: 'export const example = 1;\n',
		[`${rulePath}/fixtures/fail/src/example.ts`]: 'export const example = 2;\n',
	};

	for (const [path, content] of Object.entries(files)) {
		const absolutePath = join(libraryPath, path);

		mkdirSync(dirname(absolutePath), { recursive: true });
		writeFileSync(absolutePath, content);
	}

	return libraryPath;
};

/**
 * A temp repo whose built-in library (LIGHTSOUT_DEFAULT_STANDARDS) declares
 * lightsout/demo-rule, plus two folder libraries both named house: one whose
 * rule requires a lightsout rule id that does not exist, one whose rule
 * requires lightsout/demo-rule. The environment is replaced outright;
 * restoreMocks puts the real one back after each test.
 */
const setupRequiringRepo = () => {
	const cwd = mkdtempSync(join(tmpdir(), 'lightsout-resolve-libraries-requires-'));
	const builtInPath = writeLibrary({ cwd, at: 'built-in', name: 'lightsout', ruleFolder: '01-demo-rule' });

	writeLibrary({ cwd, at: 'standards/broken', name: 'house', ruleFolder: '01-house-rule', requires: ['lightsout/no-such-rule'] });
	writeLibrary({ cwd, at: 'standards/sound', name: 'house', ruleFolder: '01-house-rule', requires: ['lightsout/demo-rule'] });
	jest.replaceProperty(process, 'env', { ...process.env, LIGHTSOUT_DEFAULT_STANDARDS: builtInPath });

	const broken: LightsoutConfig = { ...baseConfig, 'standards-libraries': { house: './standards/broken' } };
	const sound: LightsoutConfig = { ...baseConfig, 'standards-libraries': { house: './standards/sound' } };

	return { cwd, broken, sound };
};

describe('resolveStandardsLibraries', () => {
	test('fails loading when a registered library requires a rule no loaded library declares', async () => {
		const { cwd, broken, sound } = setupRequiringRepo();

		const [brokenError, loaded] = await Promise.all([
			getRejectionError({ promise: resolveStandardsLibraries({ cwd, config: broken }) }),
			resolveStandardsLibraries({ cwd, config: sound }),
		]);

		// the requiring rule's full name and the entry that matches no rule
		expect(brokenError.message).toContain('house/house-rule');
		expect(brokenError.message).toContain('lightsout/no-such-rule');
		expect(loaded.map((library) => ({ name: library.name, rules: library.rules.map((rule) => ({ name: rule.name, requires: rule.requires })) }))).toStrictEqual(
			[
				{ name: 'lightsout', rules: [{ name: 'lightsout/demo-rule', requires: [] }] },
				{ name: 'house', rules: [{ name: 'house/house-rule', requires: ['lightsout/demo-rule'] }] },
			],
		);
	});
});
