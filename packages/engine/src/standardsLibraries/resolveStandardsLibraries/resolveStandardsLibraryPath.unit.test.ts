import { mkdirSync, mkdtempSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { messageOf } from '#src/common/messageOf.ts';
import { resolveStandardsLibraryPath } from '#src/standardsLibraries/resolveStandardsLibraries/resolveStandardsLibraryPath.ts';

interface Entry {
	name: string;
	value: string;
}

/** Marks a folder as a library root — only the file's presence decides, never its contents. */
const writeManifestIn = ({ folder }: { folder: string }) => {
	mkdirSync(folder, { recursive: true });
	writeFileSync(join(folder, 'lightsout-standards.json'), '{ "name": "house", "formatVersion": 2 }\n');
};

/** Runs one entry, answering with its folder or the message it threw, so a table of entries is one act. */
const outcomeOf = ({ cwd, entry }: { cwd: string; entry: Entry }): { path: string } | { message: string } => {
	try {
		return { path: resolveStandardsLibraryPath({ cwd, name: entry.name, value: entry.value }) };
	} catch (error) {
		return { message: messageOf({ error }) };
	}
};

/**
 * A temp tree: `<root>/repo/app` is the cwd and holds a `house` library folder
 * and an `empty` folder with no manifest; `<root>/elsewhere` is a library reached
 * by absolute path; `<root>/node_modules/acme-standards` is a symlink to the
 * library's source at `<root>/sources/acme-standards`, so a package lookup must
 * walk up from cwd and then follow the link.
 *
 * The root is taken through realpath because the OS temp folder is itself a
 * symlink on macOS — without it the expected paths would never match.
 */
const setupTree = () => {
	const root = realpathSync(mkdtempSync(join(tmpdir(), 'lightsout-library-path-')));
	const cwd = join(root, 'repo', 'app');
	const elsewherePath = join(root, 'elsewhere');
	const packageSourcePath = join(root, 'sources', 'acme-standards');

	writeManifestIn({ folder: join(cwd, 'house') });
	mkdirSync(join(cwd, 'empty'), { recursive: true });
	writeManifestIn({ folder: elsewherePath });
	writeManifestIn({ folder: packageSourcePath });
	mkdirSync(join(root, 'node_modules'), { recursive: true });
	symlinkSync(packageSourcePath, join(root, 'node_modules', 'acme-standards'), 'dir');

	return { cwd, elsewherePath, packageSourcePath };
};

describe('resolveStandardsLibraryPath', () => {
	test('resolveStandardsLibraryPath tells folder entries from package entries and resolves packages to their real path', () => {
		const { cwd, elsewherePath, packageSourcePath } = setupTree();
		const entries: Entry[] = [
			{ name: 'house', value: './house' },
			{ name: 'up', value: '../app/house' },
			{ name: 'elsewhere', value: elsewherePath },
			{ name: 'acme', value: 'acme-standards' },
			// a bare name is a package name even when cwd holds a library folder of that name
			{ name: 'house', value: 'house' },
		];

		const outcomes = entries.map((entry) => outcomeOf({ cwd, entry }));

		expect(outcomes).toEqual([
			{ path: join(cwd, 'house') },
			{ path: join(cwd, 'house') },
			{ path: elsewherePath },
			{ path: packageSourcePath },
			{ message: expect.any(String) },
		]);
	});

	test('resolveStandardsLibraryPath refuses reserved and malformed keys and entries that name no library', () => {
		const { cwd } = setupTree();
		const entries: Entry[] = [
			{ name: 'lightsout', value: './house' },
			{ name: 'acme/core', value: './house' },
			{ name: 'bare', value: './empty' },
			{ name: 'missing', value: 'missing-standards' },
		];

		const outcomes = entries.map((entry) => {
			const outcome = outcomeOf({ cwd, entry });
			const message = 'message' in outcome ? outcome.message : '';

			return {
				threw: 'message' in outcome,
				namesKey: message.includes(entry.name),
				namesValue: message.includes(entry.value),
				saysReserved: /reserved/i.test(message),
			};
		});

		// only the reserved key's wording is pinned; the other messages may word their reason freely
		expect(outcomes).toEqual([
			{ threw: true, namesKey: true, namesValue: true, saysReserved: true },
			{ threw: true, namesKey: true, namesValue: true, saysReserved: expect.any(Boolean) },
			{ threw: true, namesKey: true, namesValue: true, saysReserved: expect.any(Boolean) },
			{ threw: true, namesKey: true, namesValue: true, saysReserved: expect.any(Boolean) },
		]);
	});
});
