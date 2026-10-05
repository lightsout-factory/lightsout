import { describe, expect, test } from '@jest/globals';
import { GapArea } from '#src/contracts/plan/grade/GapArea.ts';
import { GapCheckLens } from '#src/contracts/plan/grade/GapCheckLens.ts';
import { GapOutcome } from '#src/contracts/plan/grade/GapOutcome.ts';
import { GradeFindingStatus } from '#src/contracts/plan/memory/GradeFindingStatus.ts';
import { mergeFindingRecords } from '#src/plan/runPlanGrade/runGradePass/mergeFindingRecords/mergeFindingRecords.ts';
import { mergeFindingFixtures } from '#tests/helpers/mergeFindingFixtures.ts';

const { seenAt, passAt, recordOf, gapOf, observationOf, retryLimitSeen, retryCountSeen, sharedDefect, agentRuling, agentNoted, pendingState, setupMerge } =
	mergeFindingFixtures;

describe('mergeFindingRecords', () => {
	test('opens one record holding every observation of a confirmed group', () => {
		const { memory, gaps } = setupMerge({
			gaps: [
				gapOf({ groupId: 'g1', sharedDefect, observations: [retryLimitSeen, retryCountSeen] }),
				gapOf({ ...retryCountSeen, groupId: 'g1', sharedDefect, observations: [retryLimitSeen, retryCountSeen] }),
			],
		});

		const merged = mergeFindingRecords({ memory, gaps, at: passAt });

		// one confirmed defect is one repair item, however many readers described it
		expect(merged.memory).toEqual(
			expect.objectContaining({
				nextFindingNumber: 2,
				findings: [
					expect.objectContaining({
						id: 'f1',
						status: GradeFindingStatus.Open,
						disposition: GapOutcome.NeedsAHuman,
						sharedDefect,
						observations: [retryLimitSeen, retryCountSeen],
					}),
				],
			}),
		);
		expect(merged.gaps.map((gap) => gap.findingId)).toStrictEqual(['f1', 'f1']);
	});

	test('lets the existing record absorb a group whose members all match it', () => {
		const { memory, gaps } = setupMerge({
			findings: [recordOf({ observations: [retryLimitSeen] })],
			gaps: [
				gapOf({ findingId: 'f1', groupId: 'g1', sharedDefect, observations: [retryLimitSeen, retryCountSeen] }),
				gapOf({ ...retryCountSeen, findingId: 'f1', groupId: 'g1', sharedDefect, observations: [retryLimitSeen, retryCountSeen] }),
			],
		});

		const merged = mergeFindingRecords({ memory, gaps, at: passAt });

		// opening a second record here would fragment the defect again on every pass
		expect(merged.memory).toEqual(
			expect.objectContaining({
				nextFindingNumber: 2,
				findings: [expect.objectContaining({ id: 'f1', firstSeen: seenAt, lastSeen: passAt, observations: [retryLimitSeen, retryCountSeen] })],
			}),
		);
		expect(merged.gaps.map((gap) => gap.findingId)).toStrictEqual(['f1', 'f1']);
	});

	test('supersedes the later record when a group spans two existing records', () => {
		const priorReopen = { at: seenAt, reason: 'the retry count came undone in phase two', priorStatus: GradeFindingStatus.Resolved };
		const { memory, gaps } = setupMerge({
			findings: [
				recordOf({ id: 'f9', observations: [retryLimitSeen] }),
				recordOf({ ...retryCountSeen, id: 'f10', observations: [retryCountSeen], reopened: [priorReopen] }),
			],
			gaps: [
				gapOf({ ...retryCountSeen, findingId: 'f10', groupId: 'g1', sharedDefect, observations: [retryLimitSeen, retryCountSeen] }),
				gapOf({ findingId: 'f9', groupId: 'g1', sharedDefect, observations: [retryLimitSeen, retryCountSeen] }),
			],
		});

		const merged = mergeFindingRecords({ memory, gaps, at: passAt });

		// creation order picks the survivor — numerically, since `f10` sorts before
		// `f9` as a string — and the absorbed record keeps its whole history
		expect(merged.memory.findings).toEqual([
			expect.objectContaining({ id: 'f9', observations: [retryLimitSeen, retryCountSeen] }),
			expect.objectContaining({
				id: 'f10',
				status: GradeFindingStatus.Superseded,
				supersededBy: 'f9',
				firstSeen: seenAt,
				disposition: GapOutcome.NeedsAHuman,
				reopened: [priorReopen],
			}),
		]);
		expect(merged.gaps.map((gap) => gap.findingId)).toStrictEqual(['f9', 'f9']);
	});

	test('raises a closed survivor to open when it absorbs an unanswered obligation', () => {
		const { memory, gaps } = setupMerge({
			findings: [
				recordOf({ ...agentNoted, observations: [retryLimitSeen] }),
				recordOf({ ...retryCountSeen, id: 'f2', humanDecision: 'pick the retry count phase two follows', observations: [retryCountSeen] }),
			],
			gaps: [
				gapOf({ ...agentRuling, findingId: 'f1', groupId: 'g1', sharedDefect, observations: [retryLimitSeen, retryCountSeen] }),
				gapOf({ ...retryCountSeen, ...agentRuling, findingId: 'f2', groupId: 'g1', sharedDefect, observations: [retryLimitSeen, retryCountSeen] }),
			],
		});

		const merged = mergeFindingRecords({ memory, gaps, at: passAt });

		// the earlier record survives, but a question nobody answered cannot be
		// closed by moving it onto a record that happened to be settled
		expect(merged.memory.findings).toEqual([
			expect.objectContaining({
				id: 'f1',
				status: GradeFindingStatus.Open,
				disposition: GapOutcome.AgentCanDecide,
				humanDecision: 'pick the retry count phase two follows',
				resolutions: [],
				reopened: [expect.objectContaining({ at: passAt, priorStatus: GradeFindingStatus.Noted, reason: expect.stringContaining('f2') })],
			}),
			expect.objectContaining({ id: 'f2', status: GradeFindingStatus.Superseded, supersededBy: 'f1' }),
		]);
	});

	test("clears a resolved survivor's citations when it absorbs a pending obligation and leaves an all-closed group closed", () => {
		const timeoutSeen = observationOf({ gap: 'the plan names no default timeout', decision: 'how long a judge may run' });
		const timeoutElsewhere = observationOf({ ...retryCountSeen, gap: 'phase two times a judge out after an hour', decision: 'which timeout applies' });
		const timeoutGroup = { groupId: 'g2', sharedDefect: 'the phases disagree on the timeout', observations: [timeoutSeen, timeoutElsewhere] };
		const { memory, gaps } = setupMerge({
			findings: [
				recordOf({
					status: GradeFindingStatus.Resolved,
					resolutions: [{ phase: 'phase1-memory.md', answerAt: 'a judge is retried twice', verifiedAt: seenAt }],
					observations: [retryLimitSeen],
				}),
				recordOf({ ...retryCountSeen, ...pendingState, id: 'f2', observations: [retryCountSeen] }),
				recordOf({ ...timeoutSeen, ...agentNoted, id: 'f3', observations: [timeoutSeen] }),
				recordOf({ ...timeoutElsewhere, ...agentNoted, id: 'f4', observations: [timeoutElsewhere] }),
			],
			gaps: [
				gapOf({ ...agentRuling, findingId: 'f1', groupId: 'g1', sharedDefect, observations: [retryLimitSeen, retryCountSeen] }),
				gapOf({ ...retryCountSeen, ...agentRuling, findingId: 'f2', groupId: 'g1', sharedDefect, observations: [retryLimitSeen, retryCountSeen] }),
				gapOf({ ...timeoutSeen, ...agentRuling, ...timeoutGroup, findingId: 'f3' }),
				gapOf({ ...timeoutElsewhere, ...agentRuling, ...timeoutGroup, findingId: 'f4' }),
			],
		});

		const merged = mergeFindingRecords({ memory, gaps, at: passAt });

		// the old citation never covered phase two, so the survivor is re-verified
		// everywhere; a group with no unanswered member has nothing to raise
		expect(merged.memory.findings).toEqual([
			expect.objectContaining({ id: 'f1', status: GradeFindingStatus.Open, resolutions: [] }),
			expect.objectContaining({ id: 'f2', status: GradeFindingStatus.Superseded, supersededBy: 'f1' }),
			expect.objectContaining({ id: 'f3', status: GradeFindingStatus.Noted, reopened: [] }),
			expect.objectContaining({ id: 'f4', status: GradeFindingStatus.Superseded, supersededBy: 'f3' }),
		]);
	});

	test('records the ruling on a pending survivor the group raise moved to open', () => {
		const limitWithOptions = observationOf({ options: ['retry twice', 'retry three times'] });
		const { memory, gaps } = setupMerge({
			findings: [
				recordOf({ ...limitWithOptions, ...pendingState, observations: [limitWithOptions] }),
				recordOf({ ...retryCountSeen, ...pendingState, id: 'f2', observations: [retryCountSeen] }),
			],
			gaps: [
				gapOf({ ...limitWithOptions, ...agentRuling, findingId: 'f1', groupId: 'g1', sharedDefect, observations: [limitWithOptions, retryCountSeen] }),
				gapOf({ ...retryCountSeen, ...agentRuling, findingId: 'f2', groupId: 'g1', sharedDefect, observations: [limitWithOptions, retryCountSeen] }),
			],
		});

		const merged = mergeFindingRecords({ memory, gaps, at: passAt });

		// the ruling is recorded, but the raise decides the status: an absorbed
		// unanswered obligation keeps blocking, with its own question to read
		expect(merged.memory.findings).toEqual([
			expect.objectContaining({
				id: 'f1',
				status: GradeFindingStatus.Open,
				disposition: GapOutcome.AgentCanDecide,
				gap: 'the plan picks no retry limit',
				decision: 'how many times a judge is retried',
				options: ['retry twice', 'retry three times'],
			}),
			expect.objectContaining({ id: 'f2', status: GradeFindingStatus.Superseded, supersededBy: 'f1' }),
		]);
		expect(merged.memory.findings[0]?.unjudgedReason).toBeUndefined();
	});

	test('redirects a gap naming a record superseded earlier in the same fold', () => {
		const reportSeen = observationOf({
			phase: 'phase3-report.md',
			lens: GapCheckLens.Surface,
			area: GapArea.UnderspecifiedSurface,
			gap: 'the report never says which retry count it prints',
			decision: 'which retry count the report prints',
		});
		const { memory, gaps } = setupMerge({
			findings: [
				recordOf({ ...pendingState, id: 'f9', observations: [retryLimitSeen] }),
				recordOf({ ...retryCountSeen, ...pendingState, id: 'f10', observations: [retryCountSeen] }),
			],
			gaps: [
				gapOf({ findingId: 'f9', groupId: 'g1', sharedDefect, observations: [retryLimitSeen, retryCountSeen] }),
				gapOf({ ...retryCountSeen, findingId: 'f10', groupId: 'g1', sharedDefect, observations: [retryLimitSeen, retryCountSeen] }),
				gapOf({ ...reportSeen, findingId: 'f10', humanDecision: 'say which retry count the report prints', observations: [] }),
			],
		});

		const merged = mergeFindingRecords({ memory, gaps, at: passAt });

		// the third judge named `f10` before this fold absorbed it; its finding
		// follows the obligation to `f9` rather than landing where nothing checks
		expect(merged.memory.findings).toEqual([
			expect.objectContaining({ id: 'f9', status: GradeFindingStatus.Open, observations: [retryLimitSeen, retryCountSeen, reportSeen] }),
			expect.objectContaining({ id: 'f10', status: GradeFindingStatus.Superseded, supersededBy: 'f9' }),
		]);
		expect(merged.gaps.map((gap) => gap.findingId)).toStrictEqual(['f9', 'f9', 'f9']);
	});
});
