import { z } from 'zod';

/**
 * `status` is a plain string, not the `TestCaseStatus` union: an unknown status
 * must read as "not passing" rather than make the whole file fail to parse and
 * be dropped.
 */
export const TestResultsFile = z.object({
	testResults: z
		.array(
			z.object({
				/** Absolute path as the runner reported it. */
				testFilePath: z.string().min(1),
				assertionResults: z
					.array(
						z.object({
							title: z.string(),
							ancestorTitles: z.array(z.string()).default([]),
							fullName: z.string(),
							status: z.string().min(1),
							durationMs: z.number().optional(),
						}),
					)
					.default([]),
			}),
		)
		.default([]),
});

export type TestResultsFile = z.infer<typeof TestResultsFile>;
