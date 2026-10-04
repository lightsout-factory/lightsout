import { describe, expect, test } from '@jest/globals';
import { GapArea } from '#src/contracts/plan/grade/GapArea.ts';
import { GapCheckLens } from '#src/contracts/plan/grade/GapCheckLens.ts';
import { GapOutcome } from '#src/contracts/plan/grade/GapOutcome.ts';
import { GradeFindingStatus } from '#src/contracts/plan/memory/GradeFindingStatus.ts';
import { mergeFindingRecords } from '#src/plan/runPlanGrade/runGradePass/mergeFindingRecords/mergeFindingRecords.ts';
import { mergeFindingFixtures } from '#tests/helpers/mergeFindingFixtures.ts';

const { seenAt, passAt, recordOf, gapOf, observationOf, retryLimitSeen, retryCountSeen, agentRuling, pendingState, setupMerge } = mergeFindingFixtures;

describe('mergeFindingRecords', () => {
	test('every judged outcome enters the memory with the status its disposition implies', () => {
		const { memory, gaps } = setupMerge({
			gaps: [
				gapOf(),
				gapOf({
					gap: 'the plan names no default timeout',
					outcome: GapOutcome.AgentCanDecide,
					humanDecision: undefined,
					agentDecision: 'retry twice',
					safeBecause: 'the standards settle it',
				}),
				gapOf({
					gap: 'the plan never says which file holds the floor',
					outcome: GapOutcome.AlreadyAnswered,
					humanDecision: undefined,
					answerAt: 'Decision Log row 4',
				}),
			],
		});

		const merged = mergeFindingRecords({ memory, gaps, at: passAt });

		// a human's question stays open; a question a judge settled is kept only so
		// the next pass does not re-investigate it, and blocks nothing
		expect(merged.memory).toEqual(
			expect.objectContaining({
				nextFindingNumber: 4,
				findings: [
					expect.objectContaining({
						id: 'f1',
						status: GradeFindingStatus.Open,
						disposition: GapOutcome.NeedsAHuman,
						humanDecision: 'pick the retry limit',
						firstSeen: passAt,
						lastSeen: passAt,
					}),
					expect.objectContaining({
						id: 'f2',
						status: GradeFindingStatus.Noted,
						disposition: GapOutcome.AgentCanDecide,
						agentDecision: 'retry twice',
						safeBecause: 'the standards settle it',
					}),
					expect.objectContaining({
						id: 'f3',
						status: GradeFindingStatus.Noted,
						disposition: GapOutcome.AlreadyAnswered,
						answerAt: 'Decision Log row 4',
					}),
				],
			}),
		);
		expect(merged.gaps.map((gap) => gap.findingId)).toStrictEqual(['f1', 'f2', 'f3']);
	});

	test('an unjudged finding enters the memory as a pending record with no disposition', () => {
		const unjudged = gapOf({
			outcome: GapOutcome.Unjudged,
			humanDecision: undefined,
			unjudgedReason: 'no judge ran — the fan-out stopped before this finding was judged',
		});

		const { memory, gaps } = setupMerge({ gaps: [unjudged] });

		const merged = mergeFindingRecords({ memory, gaps, at: passAt });

		// nobody weighed it, so there is no disposition to record — and it is kept
		// as pending, which blocks, rather than lost with the grade.json it lived in
		expect(merged.memory).toEqual(
			expect.objectContaining({
				findings: [
					expect.objectContaining({
						id: 'f1',
						status: GradeFindingStatus.Pending,
						disposition: undefined,
						unjudgedReason: 'no judge ran — the fan-out stopped before this finding was judged',
					}),
				],
				nextFindingNumber: 2,
			}),
		);
		expect(merged.gaps).toEqual([{ ...unjudged, findingId: 'f1' }]);
	});

	test('contrary evidence reopens a resolved record and records why', () => {
		const { memory, gaps } = setupMerge({
			findings: [
				recordOf({
					status: GradeFindingStatus.Resolved,
					resolutions: [{ phase: 'phase1-memory.md', answerAt: 'a judge is retried twice', verifiedAt: seenAt }],
				}),
			],
			gaps: [gapOf({ findingId: 'f1', humanDecision: 'the retry limit is still unspecified' })],
		});

		const merged = mergeFindingRecords({ memory, gaps, at: passAt });

		// the one path that corrects a wrong clearance — and it writes down what it
		// undid, so the reopening is auditable rather than silent
		expect(merged.memory.findings).toEqual([
			expect.objectContaining({
				id: 'f1',
				status: GradeFindingStatus.Open,
				resolutions: [],
				lastSeen: passAt,
				reopened: [{ at: passAt, reason: 'the retry limit is still unspecified', priorStatus: GradeFindingStatus.Resolved }],
			}),
		]);
	});

	test('a re-reported settled finding stays settled', () => {
		const { memory, gaps } = setupMerge({
			findings: [
				recordOf({
					id: 'f1',
					status: GradeFindingStatus.Noted,
					disposition: GapOutcome.AlreadyAnswered,
					humanDecision: undefined,
					answerAt: 'Decision Log row 4',
				}),
				recordOf({
					id: 'f2',
					gap: 'the plan names no default timeout',
					status: GradeFindingStatus.Noted,
					disposition: GapOutcome.AgentCanDecide,
					humanDecision: undefined,
					agentDecision: 'retry twice',
					safeBecause: 'the standards settle it',
				}),
				recordOf({
					id: 'f3',
					gap: 'the plan never says which file holds the floor',
					status: GradeFindingStatus.Resolved,
					resolutions: [{ phase: 'phase1-memory.md', answerAt: 'a judge is retried twice', verifiedAt: seenAt }],
				}),
			],
			gaps: [
				gapOf({
					findingId: 'f1',
					outcome: GapOutcome.AlreadyAnswered,
					humanDecision: undefined,
					answerAt: 'Decision Log row 4',
				}),
				gapOf({
					findingId: 'f2',
					gap: 'the plan names no default timeout',
					outcome: GapOutcome.AgentCanDecide,
					humanDecision: undefined,
					agentDecision: 'retry twice',
					safeBecause: 'the standards settle it',
				}),
				gapOf({
					findingId: 'f3',
					gap: 'the plan never says which file holds the floor',
					outcome: GapOutcome.AlreadyAnswered,
					humanDecision: undefined,
					answerAt: 'Decision Log row 4',
				}),
			],
		});

		const merged = mergeFindingRecords({ memory, gaps, at: passAt });

		// only a needs-a-human ruling may undo a closure, so each record is touched
		// once — to say it was seen again this pass — and no duplicate is opened
		expect(merged.memory).toEqual(
			expect.objectContaining({
				nextFindingNumber: 4,
				findings: [
					expect.objectContaining({ id: 'f1', status: GradeFindingStatus.Noted, lastSeen: passAt, reopened: [] }),
					expect.objectContaining({ id: 'f2', status: GradeFindingStatus.Noted, lastSeen: passAt, reopened: [] }),
					expect.objectContaining({
						id: 'f3',
						status: GradeFindingStatus.Resolved,
						resolutions: [{ phase: 'phase1-memory.md', answerAt: 'a judge is retried twice', verifiedAt: seenAt }],
						lastSeen: passAt,
						reopened: [],
					}),
				],
			}),
		);
	});

	test('an open record cannot be downgraded to an agent decision', () => {
		const { memory, gaps } = setupMerge({
			findings: [recordOf()],
			gaps: [
				gapOf({
					findingId: 'f1',
					outcome: GapOutcome.AgentCanDecide,
					humanDecision: undefined,
					agentDecision: 'retry twice',
					safeBecause: 'the standards settle it',
				}),
			],
		});

		const merged = mergeFindingRecords({ memory, gaps, at: passAt });

		// a human's question is answered in the plan, never downgraded to an
		// assumption by a later judge
		expect(merged.memory.findings).toEqual([
			expect.objectContaining({
				id: 'f1',
				status: GradeFindingStatus.Open,
				disposition: GapOutcome.NeedsAHuman,
				humanDecision: 'pick the retry limit',
				agentDecision: undefined,
				safeBecause: undefined,
				lastSeen: passAt,
			}),
		]);
	});

	test('a documentation finding matches its record by phase, area and gap text', () => {
		const { memory, gaps } = setupMerge({
			findings: [
				recordOf({
					phase: 'overview.md',
					lens: undefined,
					area: GapArea.MissingDocumentation,
					gap: 'The docs list omits README.md',
					humanDecision: 'say what README.md must state',
				}),
			],
			gaps: [
				gapOf({
					phase: 'overview.md',
					lens: undefined,
					area: GapArea.MissingDocumentation,
					gap: 'the docs   list omits README.md',
					humanDecision: 'say what README.md must state',
				}),
			],
		});

		const merged = mergeFindingRecords({ memory, gaps, at: passAt });

		// the documentation checker never meets the judge, so no verdict can name
		// the record for it — without the deterministic match it would open a
		// duplicate every pass
		expect(merged.memory).toEqual(
			expect.objectContaining({
				nextFindingNumber: 2,
				findings: [expect.objectContaining({ id: 'f1', firstSeen: seenAt, lastSeen: passAt })],
			}),
		);
		expect(merged.gaps.map((gap) => gap.findingId)).toStrictEqual(['f1']);
	});

	test('opens one pending record for an unjudged finding and touches it on the next pass', () => {
		const laterAt = '2026-03-01T00:00:00.000Z';
		const unjudged = gapOf({ outcome: GapOutcome.Unjudged, humanDecision: undefined, unjudgedReason: 'the judge answered without a citation' });
		const { memory, gaps } = setupMerge({ gaps: [unjudged] });

		const first = mergeFindingRecords({ memory, gaps, at: passAt });
		const second = mergeFindingRecords({ memory: first.memory, gaps, at: laterAt });

		// nobody weighed it, so it carries no disposition — but it is on record and
		// blocks, and the same unjudged words next pass find that record again
		expect(first.memory.findings).toEqual([
			expect.objectContaining({ id: 'f1', status: GradeFindingStatus.Pending, unjudgedReason: 'the judge answered without a citation', firstSeen: passAt }),
		]);
		expect(first.memory.findings[0]?.disposition).toBeUndefined();
		expect(second.memory).toEqual(
			expect.objectContaining({
				nextFindingNumber: 2,
				findings: [expect.objectContaining({ id: 'f1', status: GradeFindingStatus.Pending, firstSeen: passAt, lastSeen: laterAt })],
			}),
		);
		expect(second.gaps.map((gap) => gap.findingId)).toStrictEqual(['f1']);
	});

	test('promotes a pending record once a judge rules on it', () => {
		const { memory, gaps } = setupMerge({
			findings: [
				recordOf({ ...pendingState, observations: [retryLimitSeen] }),
				recordOf({ ...retryCountSeen, ...pendingState, id: 'f2', observations: [retryCountSeen] }),
			],
			gaps: [gapOf({ findingId: 'f1' }), gapOf({ ...retryCountSeen, ...agentRuling, findingId: 'f2' })],
		});

		const merged = mergeFindingRecords({ memory, gaps, at: passAt });

		// the first real ruling is the disposition the record never had, and it
		// sets the status exactly as it would for a fresh finding
		expect(merged.memory.findings).toEqual([
			expect.objectContaining({ id: 'f1', status: GradeFindingStatus.Open, disposition: GapOutcome.NeedsAHuman }),
			expect.objectContaining({ id: 'f2', status: GradeFindingStatus.Noted, disposition: GapOutcome.AgentCanDecide }),
		]);
		expect(merged.memory.findings.map((record) => record.unjudgedReason)).toStrictEqual([undefined, undefined]);
	});

	test('reopens a resolved record that gains an observation at an unverified location', () => {
		const { memory, gaps } = setupMerge({
			findings: [
				recordOf({
					status: GradeFindingStatus.Resolved,
					resolutions: [{ phase: 'phase1-memory.md', answerAt: 'a judge is retried twice', verifiedAt: seenAt }],
					observations: [retryLimitSeen],
				}),
			],
			gaps: [gapOf({ ...retryCountSeen, ...agentRuling, findingId: 'f1', observations: [retryCountSeen] })],
		});

		const merged = mergeFindingRecords({ memory, gaps, at: passAt });

		// a closure is a claim about the plan files it cited — phase two is one
		// nobody verified, so even a ruling that blocks nothing cannot inherit it
		expect(merged.memory.findings).toEqual([
			expect.objectContaining({
				id: 'f1',
				status: GradeFindingStatus.Open,
				resolutions: [],
				reopened: [expect.objectContaining({ at: passAt, priorStatus: GradeFindingStatus.Resolved, reason: expect.stringContaining('phase2-judge.md') })],
			}),
		]);
	});

	test('synthesises an observation for a gap that carries none when it touches a record', () => {
		const importSeen = observationOf({
			phase: 'phase2-judge.md',
			lens: GapCheckLens.Wiring,
			area: GapArea.UnwiredDependency,
			gap: 'phase two never imports the retry limit',
			decision: 'where phase two reads the retry limit from',
			options: ['the constants module', 'the judge config'],
		});
		const { memory, gaps } = setupMerge({
			findings: [recordOf({ observations: [retryLimitSeen] })],
			gaps: [gapOf({ ...importSeen, findingId: 'f1', observations: [] })],
		});

		const merged = mergeFindingRecords({ memory, gaps, at: passAt });

		// an ordinary single ruling carries no observations, yet it still tells the
		// record it now appears in phase two, where it must be re-verified
		expect(merged.memory.findings).toEqual([expect.objectContaining({ id: 'f1', observations: [retryLimitSeen, importSeen] })]);
	});
});
