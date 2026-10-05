import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';

/** A complete manifest of a failed single-plan run, `run-single` on `plans/demo.md`, with whatever a case varies laid over it. */
export const singlePlanManifestOf = (overrides: Partial<RunManifest> = {}): RunManifest => ({
	runId: 'run-single',
	createdAt: '2026-01-01T00:00:00.000Z',
	updatedAt: '2026-01-01T00:00:03.000Z',
	plan: 'plans/demo.md',
	harness: 'claude-code',
	status: RunStatus.Failed,
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
