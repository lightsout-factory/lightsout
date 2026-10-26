import { execSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, jest, test } from '@jest/globals';
import { resolveAuthoredStandardsLibrary } from '#src/standardsLibraries/resolveAuthoredStandardsLibrary.ts';

const writeManifestIn = ({ folder, name }: { folder: string; name: string }) => {
	mkdirSync(folder, { recursive: true });
	writeFileSync(join(folder, 'lightsout-standards.json'), `{ "name": "${name}", "formatVersion": 2 }\n`);
};

/**
 * A temp install whose shipped library is named `shipped`, laid out as the
 * plugin is (`<install>/dist/cli.mjs` beside `<install>/standards/`), and a temp
 * repo beside it, a git worktree unless `git` is false.
 *
 * The whole suite runs with LIGHTSOUT_DEFAULT_STANDARDS pointing at this repo's
 * own library (see tooling/jest/setupTestEnvironment.ts). Left standing it
 * would answer every case below, so the environment and the running program's
 * path are replaced outright; restoreMocks puts the real ones back.
 */
const setupRepo = ({ git = true, override }: { git?: boolean; override?: 'library' | 'notALibrary' } = {}) => {
	const root = mkdtempSync(join(tmpdir(), 'lightsout-authored-library-'));
	const cwd = join(root, 'repo');
	const overridePath = join(root, 'named-folder');
	const environment = { ...process.env };

	writeManifestIn({ folder: join(root, 'install', 'standards'), name: 'shipped' });
	mkdirSync(cwd, { recursive: true });

	if (git) {
		execSync('git init -q', { cwd });
	}

	delete environment.LIGHTSOUT_DEFAULT_STANDARDS;

	if (override !== undefined) {
		mkdirSync(overridePath, { recursive: true });

		if (override === 'library') {
			writeManifestIn({ folder: overridePath, name: 'anything' });
		}

		environment.LIGHTSOUT_DEFAULT_STANDARDS = overridePath;
	}

	jest.replaceProperty(process, 'env', environment);
	jest.replaceProperty(process, 'argv', [process.argv[0] ?? 'node', join(root, 'install', 'dist', 'cli.mjs')]);

	return { cwd, overridePath };
};

describe('resolveAuthoredStandardsLibrary', () => {
	test('finds the folder in the repo whose manifest carries the shipped library name, wherever it sits', async () => {
		const { cwd } = setupRepo();

		writeManifestIn({ folder: join(cwd, 'libs', 'house-copy'), name: 'shipped' });

		expect(await resolveAuthoredStandardsLibrary({ cwd })).toBe(join(cwd, 'libs', 'house-copy'));
	});

	test("never takes a repo's own library under another name for the built-in one", async () => {
		const { cwd } = setupRepo();

		writeManifestIn({ folder: join(cwd, 'standards'), name: 'house' });

		expect(await resolveAuthoredStandardsLibrary({ cwd })).toBeUndefined();
	});

	test('outside git, finds the repo itself when the repo is the library', async () => {
		const { cwd } = setupRepo({ git: false });

		writeManifestIn({ folder: cwd, name: 'shipped' });

		expect(await resolveAuthoredStandardsLibrary({ cwd })).toBe(cwd);
	});

	test('takes the library the environment names ahead of anything in the repo', async () => {
		const { cwd, overridePath } = setupRepo({ override: 'library' });

		writeManifestIn({ folder: join(cwd, 'libs', 'house-copy'), name: 'shipped' });

		expect(await resolveAuthoredStandardsLibrary({ cwd })).toBe(overridePath);
	});

	test('answers with nothing when the named folder holds no manifest, leaving resolveDefaultStandardsLibrary to refuse it', async () => {
		const { cwd } = setupRepo({ override: 'notALibrary' });

		writeManifestIn({ folder: join(cwd, 'libs', 'house-copy'), name: 'shipped' });

		// with the override broken there is no shipped name to match, and the
		// caller's fallback reports the broken override by name
		expect(await resolveAuthoredStandardsLibrary({ cwd })).toBeUndefined();
	});

	test('answers with nothing when the repo holds no copy of the shipped library', async () => {
		const { cwd } = setupRepo();

		expect(await resolveAuthoredStandardsLibrary({ cwd })).toBeUndefined();
	});
});
