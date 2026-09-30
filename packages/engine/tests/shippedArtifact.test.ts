import { readdir, readFile, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, sep } from 'node:path';
import { expect, test } from '@jest/globals';

// Two properties the shipped plugin rests on that nothing else would notice
// breaking. Both fail silently rather than loudly, which is why they are tested
// here rather than left to be discovered by a user.

const repoRoot = join(__dirname, '..', '..', '..');

/** Every file under a directory, as slash-separated relative paths. */
const filesUnder = async ({ dir }: { dir: string }): Promise<string[]> => {
	const entries = await readdir(dir, { recursive: true });
	const files = await Promise.all(entries.map(async (entry) => ((await stat(join(dir, entry))).isFile() ? entry.split(sep).join('/') : undefined)));

	return files.filter((entry): entry is string => entry !== undefined);
};

/** Every specifier a source text imports a value through; `import type` lines are skipped. */
const valueImportSpecifiers = ({ text }: { text: string }): string[] =>
	[...text.matchAll(/^import(?!\s+type\b)[^;]*?\bfrom\s+'([^']+)'/gm)].map((match) => match[1] ?? '');

/** Whether Node resolves a specifier inside the shipped copy: relative, or a key of its package.json imports map. */
const resolvesInShippedCopy = ({ specifier, importKeys }: { specifier: string; importKeys: string[] }): boolean =>
	specifier.startsWith('.') || importKeys.some((key) => (key.endsWith('/*') ? specifier.startsWith(key.slice(0, -1)) : specifier === key));

test('the committed bundle can resolve a typescript from where it will run', () => {
	// The fixture half of `standards-validate` asks for a compiler by walking up
	// from the running bundle's own path. When that walk finds nothing the command
	// reports every syntax-tree rule as "not validated" — as a NOTE — and still
	// exits 0. So the authoring gate for roughly thirty rules can stop working
	// while every gate in the repo stays green.
	//
	// It resolves today because the toolchain is declared at the workspace root,
	// which is an ancestor of plugin/dist/. That is a deliberate choice and an
	// invisible one: moving typescript into the packages that use it would break
	// this with no other symptom.
	const bundle = join(repoRoot, 'plugin', 'dist', 'cli.mjs');

	expect(() => createRequire(bundle).resolve('typescript')).not.toThrow();
});

test('no shipped check imports a value through a specifier Node could not resolve', async () => {
	// A shipped standards package has no node_modules — a marketplace install
	// copies plugin/ and nothing else. Its check files load through a plain
	// `import()` under Node's type stripping, so `import type` lines vanish before
	// Node ever looks at them, while a VALUE import of the same specifier would
	// throw module-not-found at check-load time, on a user's machine.
	//
	// Every check complies today, and Biome's useImportType rule is what keeps
	// them that way. This asserts the property directly, because that rule is
	// about style everywhere else in the repo and nothing records that here it is
	// load-bearing.
	//
	// The shipped copy resolves its own `#common/*` alias through its
	// package.json, so a specifier that manifest's imports map names resolves too.
	const shipped = join(repoRoot, 'plugin', 'standards');
	const manifest = JSON.parse(await readFile(join(shipped, 'package.json'), 'utf8')) as { imports?: Record<string, string> };
	const importKeys = Object.keys(manifest.imports ?? {});
	const offenders: string[] = [];

	for (const path of (await filesUnder({ dir: shipped })).filter((entry) => entry.endsWith('.ts'))) {
		const specifiers = valueImportSpecifiers({ text: await readFile(join(shipped, path), 'utf8') });

		if (specifiers.some((specifier) => !resolvesInShippedCopy({ specifier, importKeys }))) {
			offenders.push(path);
		}
	}

	expect(offenders).toStrictEqual([]);
});

test('a shipped check may import common/ through the #common alias its package.json maps', async () => {
	// The shipped copy resolves its own `#common/*` alias through
	// plugin/standards/package.json, so a check importing common/ that way loads
	// with no node_modules. A bare package name still has nothing to resolve it.
	const shipped = join(repoRoot, 'plugin', 'standards');
	const manifest = JSON.parse(await readFile(join(shipped, 'package.json'), 'utf8')) as { imports?: Record<string, string> };
	const importKeys = Object.keys(manifest.imports ?? {});
	const specifiers: string[] = [];

	for (const path of (await filesUnder({ dir: shipped })).filter((entry) => entry.endsWith('.ts'))) {
		specifiers.push(...valueImportSpecifiers({ text: await readFile(join(shipped, path), 'utf8') }));
	}

	const bareSpecifiers = valueImportSpecifiers({ text: "import ts from 'typescript';\n" });
	const scan = {
		mapsCommon: importKeys.includes('#common/*'),
		importsThroughCommon: specifiers.some((specifier) => specifier.startsWith('#common/')),
		unresolved: specifiers.filter((specifier) => !resolvesInShippedCopy({ specifier, importKeys })),
		bareNameReported: bareSpecifiers.filter((specifier) => !resolvesInShippedCopy({ specifier, importKeys })),
	};

	expect(scan).toStrictEqual({ mapsCommon: true, importsThroughCommon: true, unresolved: [], bareNameReported: ['typescript'] });
});
