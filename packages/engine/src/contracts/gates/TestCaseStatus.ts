/** Only `Passed` proves an acceptance-test row; every other status means the behaviour was not demonstrated. */
export const TestCaseStatus = {
	Passed: 'passed',
	Failed: 'failed',
	Pending: 'pending',
	Skipped: 'skipped',
	Todo: 'todo',
	Disabled: 'disabled',
	Focused: 'focused',
} as const;

export type TestCaseStatus = (typeof TestCaseStatus)[keyof typeof TestCaseStatus];
