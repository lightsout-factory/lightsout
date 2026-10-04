import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { formatSchemaIssues } from '#src/common/formatSchemaIssues.ts';
import { messageOf } from '#src/common/messageOf.ts';

const PackageManifest = z.object({
	name: z.string().min(1),
	scripts: z.record(z.string(), z.string()).optional(),
});

const parseManifestJson = ({ raw, manifestPath }: { raw: string; manifestPath: string }): unknown => {
	try {
		return JSON.parse(raw);
	} catch (error) {
		throw new Error(`package.json at ${manifestPath} is not valid JSON: ${messageOf({ error })}`);
	}
};

interface Params {
	cwd: string;
	packagesDir: string;
	/** Package directory name (e.g. 'backend-api' under packages/). */
	packageDir: string;
}

/**
 * The `name` is what a workspace filter (`pnpm --filter <name>`) wants, and it may
 * differ from the directory. A missing, malformed or nameless package.json is a
 * hard error naming its path: the engine never guesses a filter.
 */
export const readPackageManifest = async ({ cwd, packagesDir, packageDir }: Params): Promise<{ name: string; scripts: Record<string, string> }> => {
	const manifestPath = join(cwd, packagesDir, packageDir, 'package.json');
	const raw = await readFile(manifestPath, 'utf8').catch(() => {
		throw new Error(`declared package '${packageDir}' has no package.json at ${manifestPath}`);
	});
	const parsed = PackageManifest.safeParse(parseManifestJson({ raw, manifestPath }));

	if (!parsed.success) {
		const nameless = parsed.error.issues.some((issue) => issue.path[0] === 'name');

		throw new Error(
			nameless
				? `package.json at ${manifestPath} has no "name" — required for {package} substitution`
				: `package.json at ${manifestPath} is not a valid manifest: ${formatSchemaIssues({ issues: parsed.error.issues, subject: 'package.json' })}`,
		);
	}

	return { name: parsed.data.name, scripts: parsed.data.scripts ?? {} };
};
