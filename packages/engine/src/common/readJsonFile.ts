import { readFile } from 'node:fs/promises';
import type { z } from 'zod';

interface Params<Shape> {
	path: string;
	schema: z.ZodType<Shape>;
}

/**
 * Undefined is the one answer for every way the file can fail, so a caller
 * never has to tell a crash mid-write from a file an older version wrote. Use
 * `readPlanWorkspaceFile` where a corrupt file must be a hard error.
 */
export const readJsonFile = async <Shape>({ path, schema }: Params<Shape>): Promise<Shape | undefined> => {
	const raw = await readFile(path, 'utf8').catch(() => undefined);

	if (raw === undefined) {
		return undefined;
	}

	try {
		const parsed = schema.safeParse(JSON.parse(raw));

		return parsed.success ? parsed.data : undefined;
	} catch {
		return undefined;
	}
};
