import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type ts from 'typescript';
import { createSpecifierResolver } from '#src/common/moduleGraph/createSpecifierResolver.ts';
import { readImportAliases } from '#src/common/workspace/readImportAliases.ts';

interface Params {
	cwd: string;
	/** Repo-relative; the only resolution universe — imports landing outside it are not edges. */
	files: string[];
	compiler: typeof ts;
}

/**
 * Specifiers resolve only against the caller's files. An unresolvable or
 * ambiguous one is a missing edge, which only splits groups further, never
 * into a wrong grouping. `preProcessFile` avoids a compile.
 */
export const collectImportEdges = async ({ cwd, files, compiler }: Params): Promise<Array<{ from: string; to: string }>> => {
	const resolve = createSpecifierResolver({ files, importAliases: await readImportAliases({ cwd, files }) });
	const edges: Array<{ from: string; to: string }> = [];

	for (const from of files) {
		const content = await readFile(join(cwd, from), 'utf8').catch(() => undefined);

		if (content === undefined) {
			continue;
		}

		const specifiers = [...new Set(compiler.preProcessFile(content, true, true).importedFiles.map((imported) => imported.fileName))];

		for (const specifier of specifiers) {
			const to = resolve({ from, specifier });

			if (to !== undefined && to !== from) {
				edges.push({ from, to });
			}
		}
	}

	return edges;
};
