import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';

/** A running implement run ten minutes in, for the progress view's tests; a case overrides only what it is about. */
export const runProgressManifestOf = (overrides: Partial<RunManifest> = {}): RunManifest => ({
	runId: 'run-progress-01',
	createdAt: '2026-01-01T00:00:00.000Z',
	updatedAt: '2026-01-01T00:10:00.000Z',
	plan: 'plans/demo/plan.md',
	harness: 'claude-code',
	status: RunStatus.Running,
	currentStep: null,
	steps: [],
	changedFiles: [],
	commits: [],
	packages: [],
	baselineDirtyFiles: [],
	testSubjects: [],
	acceptanceTests: [],
	approvedTests: [],
	unreachableChangedFiles: [],
	coverageExcludedChangedFiles: [],
	...overrides,
});
