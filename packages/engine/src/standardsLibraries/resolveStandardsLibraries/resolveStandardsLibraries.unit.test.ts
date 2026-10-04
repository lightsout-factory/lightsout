import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, jest, test } from '@jest/globals';
import { messageOf } from '#src/common/utils/messageOf.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { readStandardsLibrary } from '#src/standardsLibraries/readStandardsLibrary/readStandardsLibrary.ts';
import { resolveStandardsLibraries } from '#src/standardsLibraries/resolveStandardsLibraries/resolveStandardsLibraries.ts';
import { resolveStandardsLibraryPath } from '#src/standardsLibraries/resolveStandardsLibraries/resolveStandardsLibraryPath.ts';
import { getRejectionError } from '#tests/helpers/getRejectionError.ts';

const baseConfig: LightsoutConfig = { gates: { check: 'true', test: 'true', 'test-coverage': false } };

interface LibrarySpec {
	/** Repo-relative folder the library is written under. */
	at: string;
	/** The manifest name, which may differ from the key that registers it. */
	name: string;
}

/** A one-rule standards library written under `at`. */
const writeLibrary = ({ cwd, at, name }: LibrarySpec & { cwd: string }) => {
	const libraryPath = join(cwd, at);
	const rulePath = 'rules/code/demo/01-demo-rule';
	const files: Record<string, string> = {
		'lightsout-standards.json': `{ "name": "${name}", "formatVersion": 2 }\n`,
		'rules/code/demo/topic.md': '# Demo\n\nThe topic the rule argues under.\n',
		[`${rulePath}/rule.md`]: '---\nsummary: a rule the library declares\nchecks: agent\n---\n\nThe rule prose.\n',
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
 * A temp repo holding the given libraries, with LIGHTSOUT_DEFAULT_STANDARDS
 * pointed at a temp built-in library named `builtInName`. The environment is
 * replaced outright; restoreMocks puts the real one back after each test.
 */
const setupRepo = ({ libraries = [], builtInName = 'lightsout' }: { libraries?: LibrarySpec[]; builtInName?: string } = {}) => {
	const cwd = mkdtempSync(join(tmpdir(), 'lightsout-resolve-libraries-'));
	const builtInPath = writeLibrary({ cwd, at: 'built-in', name: builtInName });

	for (const spec of libraries) {
		writeLibrary({ cwd, ...spec });
	}

	jest.replaceProperty(process, 'env', { ...process.env, LIGHTSOUT_DEFAULT_STANDARDS: builtInPath });

	return { cwd, builtInPath };
};

/** The message the path resolver throws for one entry, so a wrapping error can be held to carry it. */
const readResolverMessage = ({ cwd, name, value }: { cwd: string; name: string; value: string }) => {
	try {
		resolveStandardsLibraryPath({ cwd, name, value });
	} catch (error) {
		return messageOf({ error });
	}

	throw new Error(`expected the path resolver to refuse ${name}: ${value}`);
};

/** An already-loaded library to hand in as `builtIn`, with the default override aimed at a folder that is no library. */
const setupGivenBuiltIn = async () => {
	const cwd = mkdtempSync(join(tmpdir(), 'lightsout-given-built-in-'));
	const builtIn = await readStandardsLibrary({ packPath: writeLibrary({ cwd, at: 'given', name: 'lightsout' }) });
	const notALibrary = join(cwd, 'not-a-library');

	mkdirSync(notALibrary, { recursive: true });
	jest.replaceProperty(process, 'env', { ...process.env, LIGHTSOUT_DEFAULT_STANDARDS: notALibrary });

	return { cwd, builtIn, misnamed: { ...builtIn, name: 'house' } };
};

describe('resolveStandardsLibraries', () => {
	test('resolveStandardsLibraries returns the built-in library first and then each entry in order', async () => {
		const { cwd, builtInPath } = setupRepo({
			libraries: [
				{ at: 'standards/team', name: 'team' },
				{ at: 'node_modules/acme', name: 'acme' },
			],
		});
		// keys listed out of alphabetical order, so only config key order explains the result
		const config: LightsoutConfig = { ...baseConfig, 'standards-libraries': { team: './standards/team', acme: 'acme' } };

		const [bare, registered] = await Promise.all([resolveStandardsLibraries({ cwd, config: baseConfig }), resolveStandardsLibraries({ cwd, config })]);

		expect({
			bare: bare.map((library) => library.name),
			registered: registered.map((library) => ({ name: library.name, rootPath: library.rootPath })),
		}).toStrictEqual({
			bare: ['lightsout'],
			registered: [
				{ name: 'lightsout', rootPath: builtInPath },
				{ name: 'team', rootPath: join(cwd, 'standards/team') },
				{ name: 'acme', rootPath: realpathSync(join(cwd, 'node_modules/acme')) },
			],
		});
	});

	test('resolveStandardsLibraries refuses mismatched and unresolvable libraries', async () => {
		const { cwd } = setupRepo({ libraries: [{ at: 'standards/vendor', name: 'acme' }] });
		const resolverMessage = readResolverMessage({ cwd, name: 'ghost', value: './standards/missing' });
		const mismatched: LightsoutConfig = { ...baseConfig, 'standards-libraries': { house: './standards/vendor' } };
		const unresolvable: LightsoutConfig = { ...baseConfig, 'standards-libraries': { ghost: './standards/missing' } };

		const [mismatchError, unresolvableError] = await Promise.all([
			getRejectionError({ promise: resolveStandardsLibraries({ cwd, config: mismatched }) }),
			getRejectionError({ promise: resolveStandardsLibraries({ cwd, config: unresolvable }) }),
		]);

		// the key, the manifest name that disagrees with it, and where that manifest lives
		expect(mismatchError.message).toContain('house');
		expect(mismatchError.message).toContain('acme');
		expect(mismatchError.message).toContain(join(cwd, 'standards/vendor'));
		// the resolver's own message is carried, and the key is named beside it
		expect(unresolvableError.message).toContain(resolverMessage);
		expect(unresolvableError.message).toContain('ghost');
	});

	test('resolveStandardsLibraries uses a given built-in library instead of loading one', async () => {
		const { cwd, builtIn, misnamed } = await setupGivenBuiltIn();

		const [libraries, misnamedError] = await Promise.all([
			resolveStandardsLibraries({ cwd, builtIn }),
			getRejectionError({ promise: resolveStandardsLibraries({ cwd, builtIn: misnamed }) }),
		]);

		// the override names no library, so resolving at all proves the built-in folder was never read
		expect(libraries).toHaveLength(1);
		expect(libraries[0]).toBe(builtIn);
		expect(misnamedError.message).toContain('house');
	});

	test('resolveStandardsLibraries refuses a built-in library not named lightsout', async () => {
		const { cwd } = setupRepo({ builtInName: 'acme' });

		const error = await getRejectionError({ promise: resolveStandardsLibraries({ cwd, config: baseConfig }) });

		expect(error.message).toContain('acme');
	});
});
