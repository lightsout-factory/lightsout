import type { z } from 'zod';
import { formatSchemaIssues } from '#src/common/formatSchemaIssues.ts';
import { messageOf } from '#src/common/messageOf.ts';
import { parseFrontMatter } from '#src/standardsLibraries/readStandardsLibrary/parseTopicFolder/common/parseDeclaration/parseFrontMatter.ts';

interface Params<Shape> {
	text: string;
	schema: z.ZodType<Shape>;
	/** Pack-relative; names the file in any problem reported against it. */
	filePath: string;
	/** The loader throws these as one batch. */
	problems: string[];
}

/**
 * Invalid front matter yields no declaration, so the caller drops what it would
 * have described rather than filling in defaults nobody wrote.
 */
export const parseDeclaration = <Shape>({ text, schema, filePath, problems }: Params<Shape>): { declaration?: Shape; body: string } => {
	let declaration: Shape | undefined;
	let body = '';

	try {
		const frontMatter = parseFrontMatter({ text });
		const parsed = schema.safeParse(frontMatter.data);

		body = frontMatter.body.trim();

		if (parsed.success) {
			declaration = parsed.data;
		} else {
			problems.push(`${filePath}: ${formatSchemaIssues({ issues: parsed.error.issues, subject: 'front matter' })}`);
		}
	} catch (error) {
		problems.push(`${filePath}: ${messageOf({ error })}`);
	}

	return { declaration, body };
};
