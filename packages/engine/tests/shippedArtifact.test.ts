import { execFile } from 'node:child_process';
import { copyFile, cp, mkdir, mkdtemp, readdir, readFile, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { promisify } from 'node:util';
import { expect, test } from '@jest/globals';
import { seedConfiguredCwd } from '#tests/helpers/seedConfiguredCwd.ts';

// Two properties the shipped plugin rests on that nothing else would notice
// breaking. Both fail silently rather than loudly, which is why they are tested
// here rather than left to be discovered by a user.

const repoRoot = join(__dirname, '..', '..', '..');
const run = promisify(execFile);

/**
 * The standards package as the build writes it from the authored source today.
 * A feature branch never commits build output (the pre-ship step does), so the
 * committed plugin/standards/ can lag the source it will be rebuilt from; the
 * properties below are properties of what ships, so they are read from a fresh
 * build rather than from that committed copy.
 */
const buildShippedStandards = async (): Promise<string> => {
	const out = join(await mkdtemp(join(tmpdir(), 'lightsout-shipped-standards-')), 'standards');

	await run('node', [join(repoRoot, 'scripts', 'copyStandards.mjs'), '--out', out], { cwd: repoRoot });

	return out;
};

/**
 * A fresh temp folder in the plugin's installed shape: the committed shim at
 * bin/lightsout, the bundle at dist/cli.mjs and, when asked for, the standards at
 * standards/. The bundle is the e2e globalSetup's build of current source rather
 * than the committed plugin/dist/, which can lag it the way plugin/standards/ can.
 * copyFile keeps the shim's mode and nothing here sets it, so running the copy
 * proves the committed executable bit too.
 */
const buildInstalledLayout = async ({ withStandards }: { withStandards: boolean }) => {
	const layout = await mkdtemp(join(tmpdir(), 'lightsout-installed-layout-'));

	await mkdir(join(layout, 'bin'));
	await mkdir(join(layout, 'dist'));
	await copyFile(join(repoRoot, 'plugin', 'bin', 'lightsout'), join(layout, 'bin', 'lightsout'));
	await copyFile(join(repoRoot, '.test-dist', 'cli-under-test.mjs'), join(layout, 'dist', 'cli.mjs'));

	if (withStandards) {
		const shipped = await buildShippedStandards();

		await cp(shipped, join(layout, 'standards'), { recursive: true });
	}

	return layout;
};

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
	const shipped = await buildShippedStandards();
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
	const shipped = await buildShippedStandards();
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

test('the shim runs the bundle beside it, and that bundle finds the standards beside it', async () => {
	// The engine finds its standards by walking up from process.argv[1], so a shim
	// that reached any other bundle, or left that path pointing at bin/, would break
	// every installed command. The test setup's standards override would short-circuit
	// that walk, so it is kept from the child. `--list` loads the library only for a
	// selected pack, and `run` rejects on any exit but 0.
	const layout = await buildInstalledLayout({ withStandards: true });
	const cwd = await seedConfiguredCwd({ config: { 'standards-pack': 'lightsout/standards' } });
	const env = { ...process.env, LIGHTSOUT_DEFAULT_STANDARDS: undefined };

	const { stdout } = await run(join(layout, 'bin', 'lightsout'), ['standards-check', '--list'], { cwd, env });

	expect(stdout).toContain('lightsout/object-args');
});

test("the shim hands a failing engine's exit code and error straight back to the caller", async () => {
	// Everything calling lightsout by name reads the engine's exit code and stderr
	// through the shim, so swallowing either would report a failure as success. With
	// no standards folder this also shows the passing case above found its standards
	// in the layout and not some other way.
	const layout = await buildInstalledLayout({ withStandards: false });
	const cwd = await seedConfiguredCwd({ config: { 'standards-pack': 'lightsout/standards' } });
	const env = { ...process.env, LIGHTSOUT_DEFAULT_STANDARDS: undefined };

	await expect(run(join(layout, 'bin', 'lightsout'), ['standards-check', '--list'], { cwd, env })).rejects.toMatchObject({
		code: 1,
		stderr: expect.stringContaining('bundled default standards not found next to the engine'),
	});
});

test('the shim is committed as an executable regular file, never a symlink', async () => {
	// Git records the mode a marketplace install gets. At 100644 Claude Code could
	// not run the file by name, and at 120000 a symlink would point the engine's own
	// process.argv[1] at bin/.
	const { stdout } = await run('git', ['ls-files', '-s', 'plugin/bin/lightsout'], { cwd: repoRoot });

	const mode = stdout.split(' ')[0];

	expect(mode).toBe('100755');
});
