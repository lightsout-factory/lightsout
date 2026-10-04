import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { z } from 'zod';
import { planWorkspaceDir } from '#src/plan/planWorkspaceDir.ts';

interface Params<Shape> {
	cwd: string;
	name: string;
	fileName: string;
	schema: z.ZodType<Shape>;
	/** Receives the absolute path. */
	notFound: (filePath: string) => string;
}

/** A missing or corrupt file is a hard error, never a silent empty result. */
export const readPlanWorkspaceFile = async <Shape>({ cwd, name, fileName, schema, notFound }: Params<Shape>): Promise<Shape> => {
	const filePath = join(await planWorkspaceDir({ cwd, name }), fileName);
	const raw = await readFile(filePath, 'utf8').catch(() => {
		throw new Error(notFound(filePath));
	});

	return schema.parse(JSON.parse(raw));
};
