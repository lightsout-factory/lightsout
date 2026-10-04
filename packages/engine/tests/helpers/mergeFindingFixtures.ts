import { GapArea } from '#src/contracts/plan/grade/GapArea.ts';
import { GapCheckLens } from '#src/contracts/plan/grade/GapCheckLens.ts';
import type { GapObservation } from '#src/contracts/plan/grade/GapObservation.ts';
import { GapOutcome } from '#src/contracts/plan/grade/GapOutcome.ts';
import type { GradedGap } from '#src/contracts/plan/grade/GradedGap.ts';
import type { GradeFindingRecord } from '#src/contracts/plan/memory/GradeFindingRecord.ts';
import { GradeFindingStatus } from '#src/contracts/plan/memory/GradeFindingStatus.ts';
import type { GradeMemory } from '#src/contracts/plan/memory/GradeMemory.ts';

/** When an earlier pass saw a finding, and when the pass under test runs. */
const seenAt = '2026-01-01T00:00:00.000Z';
const passAt = '2026-02-01T00:00:00.000Z';

/** One reader's report of a defect at one plan file, as a grouped gap and a record hold it. */
const observationOf = (overrides: Partial<GapObservation> = {}): GapObservation => ({
	area: GapArea.OmittedDecision,
	gap: 'the plan picks no retry limit',
	decision: 'how many times a judge is retried',
	options: [],
	phase: 'phase1-memory.md',
	lens: GapCheckLens.Decisions,
	...overrides,
});

/**
 * The memory, records and gaps a `mergeFindingRecords` case folds, as one
 * vocabulary every test file for that fold reads from.
 *
 * One copy rather than one per test file, so two files cannot disagree about
 * which defect `recordOf` and `gapOf` default to.
 */
export const mergeFindingFixtures = {
	seenAt,
	passAt,

	/** One record as an earlier pass left it: a question a human was asked to settle. */
	recordOf: (overrides: Partial<GradeFindingRecord> = {}): GradeFindingRecord => ({
		id: 'f1',
		phase: 'phase1-memory.md',
		lens: GapCheckLens.Decisions,
		area: GapArea.OmittedDecision,
		gap: 'the plan picks no retry limit',
		decision: 'how many times a judge is retried',
		options: [],
		firstSeen: seenAt,
		lastSeen: seenAt,
		status: GradeFindingStatus.Open,
		disposition: GapOutcome.NeedsAHuman,
		humanDecision: 'pick the retry limit',
		observations: [],
		resolutions: [],
		reopened: [],
		...overrides,
	}),

	/** One gap of this pass, labelled and ruled on the way the fold receives it. */
	gapOf: (overrides: Partial<GradedGap> = {}): GradedGap => ({
		area: GapArea.OmittedDecision,
		gap: 'the plan picks no retry limit',
		decision: 'how many times a judge is retried',
		options: [],
		phase: 'phase1-memory.md',
		lens: GapCheckLens.Decisions,
		outcome: GapOutcome.NeedsAHuman,
		humanDecision: 'pick the retry limit',
		observations: [],
		...overrides,
	}),

	observationOf,

	/** One defect as two readers described it: the identity `recordOf` and `gapOf` default to, and its counterpart in phase two. */
	retryLimitSeen: observationOf(),
	retryCountSeen: observationOf({
		phase: 'phase2-judge.md',
		lens: GapCheckLens.Wiring,
		area: GapArea.PhaseSeamMismatch,
		gap: 'phase two retries a judge three times',
		decision: 'which retry count the judge follows',
	}),

	/** The statement a judge confirms that group with. */
	sharedDefect: 'the two phases disagree on how often a judge is retried',

	/** A ruling that the implementing agent settles the finding, as a gap carries it and as a record keeps it. */
	agentRuling: { outcome: GapOutcome.AgentCanDecide, humanDecision: undefined, agentDecision: 'retry twice', safeBecause: 'the standards settle it' },
	agentNoted: {
		status: GradeFindingStatus.Noted,
		disposition: GapOutcome.AgentCanDecide,
		humanDecision: undefined,
		agentDecision: 'retry twice',
		safeBecause: 'the standards settle it',
	},

	/** A record no judge has settled yet. */
	pendingState: {
		status: GradeFindingStatus.Pending,
		disposition: undefined,
		humanDecision: undefined,
		unjudgedReason: 'the judge answered without a citation',
	},

	/** The memory a pass found, and the gaps it folds into it. */
	setupMerge: ({ findings = [], gaps = [] }: { findings?: GradeFindingRecord[]; gaps?: GradedGap[] } = {}) => {
		const memory: GradeMemory = {
			planName: 'lo-126-grade-memory',
			findings,
			coverage: { readers: [] },
			nextFindingNumber: findings.length + 1,
			updatedAt: seenAt,
		};

		return { memory, gaps };
	},
};
