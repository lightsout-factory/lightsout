import { cpSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * `plugin/standards/` is committed because marketplace installs copy only the
 * plugin directory and no install hook could build it later. Never edit it by
 * hand — the next bundle discards it.
 *
 * Fixtures and unit tests are left out: the engine runs without them, and
 * `lightsout standards-validate` runs against the authored package.
 *
 * The destination is removed first, so a rule deleted from the source does not
 * linger. `--out <dir>` lets the pre-push hook compare a fresh build without
 * writing into the tree it is asking about.
 */
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(repoRoot, 'packages', 'standards-typescript');
const outFlag = process.argv.indexOf('--out');

/**
 * Matched against the package root only, so a rule that owns a file of one of
 * these names deeper in the tree still ships.
 *
 * `coverage` appears only after a local coverage run, and the shipped-artifact
 * check would not catch it: a fresh build and the committed copy would both
 * carry it.
 */
const authoringFiles = new Set(['node_modules', 'coverage', 'package.json', 'tsconfig.json', 'tsconfig.jest.json', 'jest.config.cjs', 'README.md']);

const isAuthoringOnly = (path) => {
	const relativePath = relative(source, path);

	return relativePath.split(sep).includes('fixtures') || path.endsWith('.unit.test.ts') || authoringFiles.has(relativePath);
};

// The exit code is set rather than forced with `process.exit`: writes to a pipe
// are asynchronous, and exiting right after a log discards it.
if (outFlag !== -1 && process.argv[outFlag + 1] === undefined) {
	console.error('--out needs a directory');
	process.exitCode = 1;
} else {
	const destination = outFlag === -1 ? join(repoRoot, 'plugin', 'standards') : resolve(process.argv[outFlag + 1]);

	rmSync(destination, { recursive: true, force: true });
	cpSync(source, destination, { recursive: true, filter: (from) => !isAuthoringOnly(from) });

	// A marketplace install has no manifest above the checks to inherit a module
	// format from, and the authored package.json names workspace dependencies a
	// user's machine will not have. Its imports map is kept: a check in the
	// shipped copy resolves `#common/*` through this file.
	const { imports } = JSON.parse(readFileSync(join(source, 'package.json'), 'utf8'));

	writeFileSync(join(destination, 'package.json'), `${JSON.stringify({ type: 'module', imports }, null, '\t')}\n`);

	// `built` lets `lightsout standards-validate` report one fact about the
	// artifact instead of reading every stripped fixture as a rule its author
	// forgot.
	const root = JSON.parse(readFileSync(join(source, 'lightsout-standards.json'), 'utf8'));

	writeFileSync(join(destination, 'lightsout-standards.json'), `${JSON.stringify({ ...root, built: true }, null, '\t')}\n`);

	console.log(`built standards → ${destination.replace(`${repoRoot}${sep}`, '')}`);
}
