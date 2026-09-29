import { readFile } from 'node:fs/promises';
import { join, posix } from 'node:path';
import { z } from 'zod';
import type { ImportAliases } from '#src/common/types/ImportAliases.ts';

// A target is a path, or a condition map whose `import`/`default` branch is.
// Anything else — an array of fallbacks, a nested condition — resolves to no
// file this reader can name, and is left out rather than guessed at.
const ImportTarget = z.union([z.string(), z.object({ import: z.string().optional(), default: z.string().optional() })]);
const Manifest = z.object({ imports: z.record(z.string(), z.unknown()).optional() });

interface Params {
	cwd: string;
	/** Repo-relative files; every directory holding one of them, or above one, is a candidate package root. */
	files: string[];
}

const readTarget = ({ value }: { value: unknown }) => {
	const parsed = ImportTarget.safeParse(value);

	if (!parsed.success) {
		return undefined;
	}

	return typeof parsed.data === 'string' ? parsed.data : (parsed.data.import ?? parsed.data.default);
};

const collectAncestorDirectories = ({ files }: { files: string[] }) => {
	const directories = new Set<string>(['.']);

	for (const file of files) {
		for (let directory = posix.dirname(file); directory !== '.' && !directories.has(directory); directory = posix.dirname(directory)) {
			directories.add(directory);
		}
	}

	return [...directories];
};

// A manifest that cannot be read as JSON declares no aliases rather than failing the run.
export const readImportAliases = async ({ cwd, files }: Params): Promise<ImportAliases> => {
	const aliases: ImportAliases = new Map();

	for (const directory of collectAncestorDirectories({ files })) {
		const text = await readFile(join(cwd, directory, 'package.json'), 'utf8').catch(() => undefined);

		if (text === undefined) {
			continue;
		}

		let data: unknown;

		try {
			data = JSON.parse(text);
		} catch {
			data = {};
		}

		const imports = Manifest.safeParse(data).data?.imports ?? {};

		aliases.set(
			directory,
			Object.entries(imports).flatMap(([pattern, value]) => {
				const target = readTarget({ value });

				return target === undefined ? [] : [{ pattern, target }];
			}),
		);
	}

	return aliases;
};
