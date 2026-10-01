import type { ZodError } from 'zod';

interface Params {
	issues: ZodError['issues'];
	/** Stands in for the key when an issue names no path. */
	subject: string;
}

/** Every issue on one line, so an author fixes a file once rather than reloading per field. */
export const formatSchemaIssues = ({ issues, subject }: Params): string =>
	issues.map((issue) => `${issue.path.join('.') || subject} ${issue.message}`).join('; ');
