import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, parse } from 'node:path';
import { linkTypescript } from '#tests/helpers/linkTypescript.ts';
import { sourceFileGlobs } from '#tests/helpers/sourceFileGlobs.ts';
import { testFileGlobs } from '#tests/helpers/testFileGlobs.ts';

interface Params {
	/** Repo-relative paths to write, each declaring one export named for its file, so the prior-art census has a name to read. */
	existing: string[];
}

/** A temp repo holding the given existing source files, each declaring one export named for its file, with a TypeScript to read them and a config naming them as code. */
export const seedSourceRepo = ({ existing }: Params): string => {
	const cwd = mkdtempSync(join(tmpdir(), 'lightsout-dedup-run-'));

	linkTypescript({ dir: cwd });
	writeFileSync(
		join(cwd, 'lightsout.config.json'),
		JSON.stringify({ gates: { check: 'true', test: 'true', 'test-coverage': false }, 'source-files': sourceFileGlobs, 'test-files': testFileGlobs }),
	);

	for (const rel of existing) {
		const abs = join(cwd, rel);

		mkdirSync(dirname(abs), { recursive: true });
		writeFileSync(abs, `export const ${parse(rel).name} = 1;\n`);
	}

	return cwd;
};
