import { readFile } from 'node:fs/promises';
import { z } from 'zod';

const Manifest = z.object({
	dependencies: z.record(z.string(), z.string()).optional(),
	devDependencies: z.record(z.string(), z.string()).optional(),
	peerDependencies: z.record(z.string(), z.string()).optional(),
});

interface Params {
	manifestPath: string;
}

/**
 * Undefined when there is no package.json, so a directory that is not a package
 * drops out of a caller's map. A manifest that cannot be understood declares
 * nothing rather than failing the run.
 *
 * All three dependency kinds count: the question is what a package declares, not
 * what happens to be installed.
 */
export const readDependencyNames = async ({ manifestPath }: Params): Promise<string[] | undefined> => {
	const text = await readFile(manifestPath, 'utf8').catch(() => undefined);

	if (text === undefined) {
		return undefined;
	}

	let data: unknown;

	try {
		data = JSON.parse(text);
	} catch {
		return [];
	}

	const parsed = Manifest.safeParse(data);

	if (!parsed.success) {
		return [];
	}

	return [parsed.data.dependencies, parsed.data.devDependencies, parsed.data.peerDependencies].flatMap((record) => Object.keys(record ?? {}));
};
