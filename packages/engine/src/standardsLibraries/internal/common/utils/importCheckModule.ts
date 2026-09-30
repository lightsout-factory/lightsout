import { pathToFileURL } from 'node:url';
import { StandardsCheckModule } from '@lightsout/standards-contracts';
import { formatSchemaIssues } from '#src/standardsLibraries/internal/common/utils/formatSchemaIssues.ts';

interface Params {
	/** Absolute path of a rule folder's check.ts. */
	checkPath: string;
}

/**
 * The .ts file is imported under Node's native type stripping, so a check must
 * stay erasable-only and may import values from inside its own pack alone.
 *
 * @throws {Error} When the file has no `check` export, or that export is not a valid check.
 */
export const importCheckModule = async ({ checkPath }: Params): Promise<StandardsCheckModule> => {
	// The path is only known at run time, so a bundler must leave this import to Node.
	const imported: Record<string, unknown> = await import(/* @vite-ignore */ pathToFileURL(checkPath).href);
	const parsed = StandardsCheckModule.safeParse(imported.check);

	if (!parsed.success) {
		throw new Error(
			`check.ts must export \`check\` as { inputKind, run } (${checkPath}): ${formatSchemaIssues({ issues: parsed.error.issues, subject: 'check' })}`,
		);
	}

	return parsed.data;
};
