import { describe, expect, test } from '@jest/globals';
import { buildCleanupSummary } from '#src/common/buildCleanupSummary.ts';
import { CleanupEndReason } from '#src/contracts/run/CleanupEndReason.ts';
import type { PhaseReport } from '#src/contracts/run/PhaseReport.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { StepRecord } from '#src/contracts/run/StepRecord.ts';
import type { StandardsFinding } from '#src/contracts/standardsCheck/StandardsFinding.ts';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import { countableFindings } from '#tests/helpers/countableFindings.ts';

/**
 * A refactor step record carrying a cleanup report. Every list is a different
 * length, so a helper that read the wrong one reports the wrong number.
 */
const setupCleanupStep = ({ endReason }: { endReason?: CleanupEndReason } = {}): { step: StepRecord } => ({
	step: {
		id: 'refactor',
		status: RunStatus.Passed,
		attempts: 4,
		report: {
			roundsUsed: 3,
			...(endReason === undefined ? {} : { endReason }),
			remaining: countableFindings({ rule: 'file-size', count: 2 }),
			inherited: countableFindings({ rule: 'folder-size', count: 3 }),
			uncertain: countableFindings({ rule: 'star-re-export', count: 1 }),
			failures: ['refactor executor timed out after 20 minutes'],
			initialReview: countableFindings({ rule: 'naming', count: 7 }),
			finalReview: countableFindings({ rule: 'function-size', count: 5 }),
		},
	},
});

/**
 * The two ways a step can carry no cleanup record — no report at all, and a
 * coordinator's own phase report — arranged together, because they are the two
 * halves of one fact rather than two cases.
 */
const setupNonCleanupSteps = (): { unreached: StepRecord; coordinator: StepRecord } => ({
	unreached: { id: 'phase-1', status: RunStatus.Passed, attempts: 1 },
	coordinator: { id: 'phase-2', status: RunStatus.Passed, attempts: 1, report: { runId: 'run-child' } satisfies PhaseReport },
});

/**
 * Two cleanup records over the same findings: one written by an engine that
 * records `targeted` (a and b handed to cleanup, b still standing) and one an
 * older engine wrote without it. The remaining b is a separate object with a
 * different detail, so only a match by `siteKey` finds it among the targeted.
 */
const setupTargetedCleanupSteps = (): { withTargeted: StepRecord; withoutTargeted: StepRecord } => {
	const findingA: StandardsFinding = {
		rule: 'acme/max-nesting',
		severity: StandardsSeverity.Blocking,
		siteKey: 'acme/max-nesting:src/a.ts',
		files: [{ path: 'src/a.ts' }, { path: 'src/a-helper.ts' }],
		detail: 'nested 5 deep',
	};
	const findingB: StandardsFinding = {
		rule: 'acme/file-length',
		severity: StandardsSeverity.Blocking,
		siteKey: 'acme/file-length:src/b.ts',
		files: [{ path: 'src/b.ts' }],
		detail: 'b.ts holds 300 lines',
	};
	const stillStandingB: StandardsFinding = { ...findingB, detail: 'b.ts holds 280 lines' };
	const report = {
		roundsUsed: 2,
		endReason: CleanupEndReason.BudgetExhausted,
		remaining: [stillStandingB],
		inherited: [],
		uncertain: [],
		failures: [],
		initialReview: [],
		finalReview: [],
	};

	return {
		withTargeted: { id: 'refactor', status: RunStatus.Passed, attempts: 2, report: { ...report, targeted: [findingA, findingB] } },
		withoutTargeted: { id: 'refactor', status: RunStatus.Passed, attempts: 2, report },
	};
};

describe('buildCleanupSummary', () => {
	test('buildCleanupSummary: counts and lists found and fixed by siteKey, undefined for a record without targeted', () => {
		const { withTargeted, withoutTargeted } = setupTargetedCleanupSteps();

		const targetedSummary = buildCleanupSummary({ step: withTargeted });
		const olderSummary = buildCleanupSummary({ step: withoutTargeted });

		// a was handed to cleanup and no remaining finding carries its siteKey, so
		// it is the one fixed; b still stands, matched by siteKey despite its new detail
		expect(targetedSummary).toEqual(
			expect.objectContaining({
				targetedFindings: 2,
				fixedFindings: 1,
				fixedSites: [{ rule: 'acme/max-nesting', files: ['src/a.ts', 'src/a-helper.ts'] }],
				remainingSites: [{ rule: 'acme/file-length', files: ['src/b.ts'] }],
			}),
		);
		// an older record cannot say what cleanup set out to fix, so it claims no
		// count and lists nothing fixed, while its remaining findings still list
		expect(olderSummary).toEqual(
			expect.objectContaining({
				targetedFindings: undefined,
				fixedFindings: undefined,
				fixedSites: [],
				remainingSites: [{ rule: 'acme/file-length', files: ['src/b.ts'] }],
			}),
		);
	});

	test('buildCleanupSummary: a step whose report parses answers the rounds, the end reason and a count for every recorded list', () => {
		const { step } = setupCleanupStep({ endReason: CleanupEndReason.BudgetExhausted });

		const summary = buildCleanupSummary({ step });

		// carried is the inherited debt plus the findings whose provenance could
		// not be established: 3 + 1, and the review count is the FINAL review's 5
		// rather than the initial review's 7
		expect(summary).toEqual({
			rounds: 3,
			endReason: 'budget-exhausted',
			remainingFindings: 2,
			carriedFindings: 4,
			reviewFindings: 5,
			failures: 1,
			targetedFindings: undefined,
			fixedFindings: undefined,
			fixedSites: [],
			remainingSites: [
				{ rule: 'file-size', files: ['packages/engine/src/0.ts'] },
				{ rule: 'file-size', files: ['packages/engine/src/1.ts'] },
			],
		});
	});

	test('buildCleanupSummary: a step carrying no cleanup report answers undefined rather than a zeroed summary', () => {
		const { unreached, coordinator } = setupNonCleanupSteps();

		const unreachedSummary = buildCleanupSummary({ step: unreached });
		const coordinatorSummary = buildCleanupSummary({ step: coordinator });

		// a zeroed summary here would print a cleanup line claiming a pass that
		// never ran, on a step that is not the cleanup step at all
		expect(unreachedSummary).toBeUndefined();
		expect(coordinatorSummary).toBeUndefined();
	});

	test('buildCleanupSummary: a mid-loop record answers its rounds with no end reason', () => {
		const { step } = setupCleanupStep();

		const summary = buildCleanupSummary({ step });

		// the step writes the record before every invocation, so a parked run
		// reports what it spent without claiming cleanup ended
		expect(summary).toEqual({
			rounds: 3,
			endReason: undefined,
			remainingFindings: 2,
			carriedFindings: 4,
			reviewFindings: 5,
			failures: 1,
			targetedFindings: undefined,
			fixedFindings: undefined,
			fixedSites: [],
			remainingSites: [
				{ rule: 'file-size', files: ['packages/engine/src/0.ts'] },
				{ rule: 'file-size', files: ['packages/engine/src/1.ts'] },
			],
		});
	});
});
