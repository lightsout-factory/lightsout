import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, jest, test } from '@jest/globals';
import type { EvidenceHeadline } from '#src/contracts/views/planEvidence/EvidenceHeadline.ts';
import { EvidenceProvenance } from '#src/contracts/views/planEvidence/EvidenceProvenance.ts';
import { EvidenceSectionState } from '#src/contracts/views/planEvidence/EvidenceSectionState.ts';
import type { PlanEvidence } from '#src/contracts/views/planEvidence/PlanEvidence.ts';
import { PlanProgress } from '#src/contracts/workOrder/PlanProgress.ts';
import { WorkOrderMode } from '#src/contracts/workOrder/WorkOrderMode.ts';
import { getWorkOrderEvidence } from '#src/views/getWorkOrderEvidence.ts';
import { PlanWorkspaceNotFoundError } from '#src/views/PlanWorkspaceNotFoundError.ts';
import { freshCwd } from '#tests/helpers/freshCwd.ts';

// Mocked Imports
// -------------------------
// Each plan's evidence is its own view with its own tests; what this file owns
// is which plans are asked for it, which count as covered, and how their
// headlines total.
type PlanEvidenceParams = { cwd: string; name: string };

const mockGetPlanEvidence = jest.fn<(params: PlanEvidenceParams) => Promise<PlanEvidence>>();

jest.mock('#src/views/getPlanEvidence/getPlanEvidence.ts', () => ({
	getPlanEvidence: (params: PlanEvidenceParams) => mockGetPlanEvidence(params),
}));
// -------------------------

/** The work order every case reads, its folder name and its branch alike. */
const name = 'add-search';

const mergedAt = '2026-03-05T12:07:00.000Z';

interface PlanRow {
	id: string;
	excluded?: boolean;
}

/** One plan as the work-order record holds it, carrying an exclusion when `excluded` is set. */
const recordPlanOf = ({ id, excluded = false }: PlanRow) => ({
	id,
	title: `Plan ${id}`,
	progress: PlanProgress.Implemented,
	createdAt: '2026-03-01T09:00:00.000Z',
	...(excluded ? { exclusion: { at: '2026-03-04T12:00:00.000Z', reason: 'folded into search', implementationRemoved: false } } : {}),
});

/** A plan's evidence holding only its headline; every section is absent and it read no problem. */
const evidenceOf = ({ planId, headline }: { planId: string; headline: EvidenceHeadline }): PlanEvidence => ({
	name: `${name}/${planId}`,
	headline,
	problems: [],
});

/**
 * A repo whose work-orders folder holds this work order's record with `plans`,
 * and a plan-evidence view that answers each address in `evidence` and refuses
 * every other address as having no plan folder.
 */
const setupWorkOrderEvidence = async ({
	plans,
	evidence,
	details = {},
}: {
	plans: PlanRow[];
	evidence: Record<string, EvidenceHeadline>;
	/** Sections and problems laid over a plan's headline-only evidence, keyed by plan id. */
	details?: Record<string, Partial<PlanEvidence>>;
}) => {
	const cwd = await freshCwd();
	const folder = join(cwd, '.lightsout', 'work-orders', name);
	const record = {
		schemaVersion: 1,
		name,
		branch: name,
		ticketRef: 'LO-7',
		mode: WorkOrderMode.MultiplePlan,
		plans: plans.map(recordPlanOf),
		history: [],
	};

	await mkdir(folder, { recursive: true });
	await writeFile(join(folder, 'state.json'), JSON.stringify(record), 'utf8');
	mockGetPlanEvidence.mockImplementation(({ name: address }) => {
		const planId = address.slice(name.length + 1);
		const headline = evidence[planId];

		return headline === undefined
			? Promise.reject(new PlanWorkspaceNotFoundError({ name: address }))
			: Promise.resolve({ ...evidenceOf({ planId, headline }), ...details[planId] });
	});

	return { cwd };
};

const measured = (value: number) => ({ value, provenance: EvidenceProvenance.Measured });

describe('getWorkOrderEvidence', () => {
	test('getWorkOrderEvidence: totals over covered plans, excluded plans left out, undefined for an unknown work order', async () => {
		const { cwd } = await setupWorkOrderEvidence({
			plans: [{ id: '001-search' }, { id: '002-filters', excluded: true }, { id: '003-sorting' }],
			evidence: {
				'001-search': {
					startedAt: '2026-03-05T10:00:00.000Z',
					mergedAt,
					questionsAsked: measured(2),
					recordedCostUsd: measured(5.5),
					findingsFixed: measured(3),
				},
				'002-filters': { startedAt: '2026-03-05T08:00:00.000Z', questionsAsked: measured(9) },
			},
		});

		const totals = await getWorkOrderEvidence({ cwd, name });
		const unknown = await getWorkOrderEvidence({ cwd, name: 'no-such-work-order' });

		expect({ totals, unknown }).toEqual({
			totals: {
				headline: {
					startedAt: '2026-03-05T10:00:00.000Z',
					mergedAt,
					questionsAsked: { value: 2, provenance: 'measured' },
					recordedCostUsd: { value: 5.5, provenance: 'measured' },
					findingsFixed: { value: 3, provenance: 'measured' },
				},
				plansCovered: 1,
				plansCounted: 2,
				problems: [],
			},
			unknown: undefined,
		});
	});

	test('getWorkOrderEvidence: sums cost, questions and fixed, and starts from the earliest plan', async () => {
		const { cwd } = await setupWorkOrderEvidence({
			plans: [{ id: '001-search' }, { id: '002-filters' }],
			evidence: {
				'001-search': {
					startedAt: '2026-03-05T10:00:00.000Z',
					mergedAt,
					questionsAsked: measured(1),
					recordedCostUsd: measured(2),
					findingsFixed: measured(2),
				},
				'002-filters': {
					startedAt: '2026-03-05T09:00:00.000Z',
					mergedAt,
					questionsAsked: measured(4),
					recordedCostUsd: measured(3),
					findingsFixed: measured(1),
				},
			},
		});

		const totals = await getWorkOrderEvidence({ cwd, name });

		expect(totals?.headline).toEqual({
			startedAt: '2026-03-05T09:00:00.000Z',
			mergedAt,
			questionsAsked: { value: 5, provenance: 'measured' },
			recordedCostUsd: { value: 5, provenance: 'measured' },
			findingsFixed: { value: 3, provenance: 'measured' },
		});
	});

	test('getWorkOrderEvidence: a plan with a section but no start is covered, one with nothing is only counted, and problems name their plan', async () => {
		const { cwd } = await setupWorkOrderEvidence({
			plans: [{ id: '001-search' }, { id: '002-filters' }],
			evidence: { '001-search': {}, '002-filters': {} },
			details: {
				'001-search': {
					plan: { state: EvidenceSectionState.Finished, gradePasses: [], findingsByStatus: [] },
					problems: ['run run-buil of add-search could not be read'],
				},
			},
		});

		const totals = await getWorkOrderEvidence({ cwd, name });

		expect(totals).toEqual({
			headline: {},
			plansCovered: 1,
			plansCounted: 2,
			problems: ['001-search: run run-buil of add-search could not be read'],
		});
	});

	test('getWorkOrderEvidence: an error other than a missing plan folder is not swallowed', async () => {
		const { cwd } = await setupWorkOrderEvidence({ plans: [{ id: '001-search' }], evidence: {} });
		mockGetPlanEvidence.mockRejectedValue(new Error('activity record unreadable'));

		await expect(getWorkOrderEvidence({ cwd, name })).rejects.toThrow('activity record unreadable');
	});
});
