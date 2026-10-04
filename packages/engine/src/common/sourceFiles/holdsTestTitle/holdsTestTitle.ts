import { findTestTitles } from '#src/common/sourceFiles/holdsTestTitle/findTestTitles.ts';
import { matchesTestTitle } from '#src/common/sourceFiles/matchesTestTitle.ts';

interface Params {
	content: string;
	/** The exact name a ledger row (or an acceptance-test record) carries. */
	testName: string;
}

/**
 * The static, cheap half of test identity. `checkAcceptanceTests` reads the
 * runner's per-test results through the same matcher, so a title accepted in
 * one place is accepted in both.
 */
export const holdsTestTitle = ({ content, testName }: Params): boolean => {
	return findTestTitles({ content }).some((title) => matchesTestTitle({ testName, title }));
};
