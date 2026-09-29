import { execFileSync } from 'node:child_process';
import { isTestFile } from '../packages/engine/src/common/sourceFiles/isTestFile.ts';

const isBarFile = ({ path }) => /\.tsx?$/.test(path) && !/\.unit\.test\.tsx?$/.test(path) && !path.endsWith('.d.ts');

const findPackRoots = ({ paths }) =>
	paths.filter((path) => path.endsWith('/lightsout-standards.json')).map((path) => path.slice(0, path.length - '/lightsout-standards.json'.length));

/**
 * A pack's fail fixtures are written to break its rules, so drawing them would
 * report a pack's samples as the repository's own sprawl. This restates
 * `listSourceFiles`' pruning because that walk reads the working tree and this
 * one reads a commit.
 */
const isPackFixture = ({ path, packRoots }) => packRoots.some((root) => path.startsWith(`${root}/`)) && path.includes('/fixtures/');

const readTree = ({ repoRoot, sha }) => {
	const output = execFileSync('git', ['ls-tree', '-r', '-z', sha, '--', 'packages'], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });

	return output
		.split('\0')
		.filter((entry) => entry.length > 0)
		.map((entry) => {
			const [meta, path] = entry.split('\t');

			return [path, meta.split(' ')[2]];
		});
};

/**
 * Keyed by blob rather than by path, because an unchanged file is the same
 * object in every commit, so each is read once. Batched through one
 * `git cat-file` per chunk rather than one child process per file.
 */
const readBlobLines = ({ repoRoot, oids }) => {
	const counts = new Map();
	const chunkSize = 500;

	for (let start = 0; start < oids.length; start += chunkSize) {
		const chunk = oids.slice(start, start + chunkSize);
		const output = execFileSync('git', ['cat-file', '--batch'], { cwd: repoRoot, input: chunk.join('\n'), maxBuffer: 512 * 1024 * 1024 });
		let cursor = 0;

		for (const oid of chunk) {
			// `<oid> blob <size>\n<contents>\n` — the size is authoritative, so the
			// contents are walked by byte rather than split on newlines.
			const headerEnd = output.indexOf(10, cursor);
			const size = Number(output.toString('utf8', cursor, headerEnd).split(' ')[2]);
			const contentStart = headerEnd + 1;
			let lines = 0;

			for (let at = output.indexOf(10, contentStart); at !== -1 && at < contentStart + size; at = output.indexOf(10, at + 1)) {
				lines += 1;
			}

			counts.set(oid, lines);
			cursor = contentStart + size + 1;
		}
	}

	return counts;
};

/**
 * Folder populations are counted the way the `folder-size` check counts them,
 * so a row drawn over cap is over cap by the repo's own measure.
 */
export const readSprawlTrees = ({ repoRoot, commits }) => {
	const trees = commits.map((commit) => {
		const entries = readTree({ repoRoot, sha: commit.sha });
		const packRoots = findPackRoots({ paths: entries.map(([path]) => path) });

		return entries.filter(([path]) => !isPackFixture({ path, packRoots }));
	});
	const barOids = new Set();

	for (const tree of trees) {
		for (const [path, oid] of tree) {
			if (isBarFile({ path })) {
				barOids.add(oid);
			}
		}
	}

	const lineCounts = readBlobLines({ repoRoot, oids: [...barOids] });

	return trees.map((tree) => {
		const packRoots = findPackRoots({ paths: tree.map(([path]) => path) });
		const files = new Map();
		const folders = new Map();

		for (const [path, oid] of tree) {
			if (isBarFile({ path })) {
				files.set(path, lineCounts.get(oid));
			}

			if (!isTestFile({ path, standardsPacks: packRoots })) {
				const directory = path.slice(0, path.lastIndexOf('/'));

				folders.set(directory, (folders.get(directory) ?? 0) + 1);
			}
		}

		return { files, folders };
	});
};
