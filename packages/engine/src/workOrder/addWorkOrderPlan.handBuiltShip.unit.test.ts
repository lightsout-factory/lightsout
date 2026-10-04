import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, jest, test } from '@jest/globals';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { WorkOrderEventKind } from '#src/contracts/workOrder/WorkOrderEventKind.ts';
import { WorkOrderMode } from '#src/contracts/workOrder/WorkOrderMode.ts';
import type { WorkOrderState } from '#src/contracts/workOrder/WorkOrderState.ts';
import type { TrackerAttachment } from '#src/ticketTracker/common/types/TrackerAttachment.ts';
import type { TrackerFailure } from '#src/ticketTracker/common/types/TrackerFailure.ts';
import type { TrackerSettings } from '#src/ticketTracker/common/types/TrackerSettings.ts';
import type { TrackerTicket } from '#src/ticketTracker/common/types/TrackerTicket.ts';
import { addWorkOrderPlan } from '#src/workOrder/addWorkOrderPlan.ts';
import { updateLocalWorkOrderState } from '#src/workOrder/updateLocalWorkOrderState.ts';

// Mocked Imports
// -------------------------
// The tracker barrel is the only seam mocked: the record is a real file in a
// temporary checkout, because the claim is about which bytes reach the record.
const mockGetTicketAttachments = jest.fn<(params: { settings: TrackerSettings; identifier: string }) => Promise<TrackerAttachment[] | TrackerFailure>>();
const mockGetTicketsByIdentifiers = jest.fn<(params: { settings: TrackerSettings; identifiers: string[] }) => Promise<TrackerTicket[] | TrackerFailure>>();
const mockReadTicketAsset = jest.fn<(params: { settings: TrackerSettings; url: string }) => Promise<string | TrackerFailure>>();
/** What `setTicketAttachment` takes, named so the mock and its wrapper each read on one line. */
type AttachmentWrite = { settings: TrackerSettings; ticketId: string; title: string; content: Buffer; contentType: string };

const mockSetTicketAttachment = jest.fn<(params: AttachmentWrite) => Promise<TrackerFailure | undefined>>();

jest.mock('#src/ticketTracker/getTicketAttachments.ts', () => ({
	getTicketAttachments: (params: { settings: TrackerSettings; identifier: string }) => mockGetTicketAttachments(params),
}));
jest.mock('#src/ticketTracker/getTicketsByIdentifiers.ts', () => ({
	getTicketsByIdentifiers: (params: { settings: TrackerSettings; identifiers: string[] }) => mockGetTicketsByIdentifiers(params),
}));
jest.mock('#src/ticketTracker/readTicketAsset.ts', () => ({
	readTicketAsset: (params: { settings: TrackerSettings; url: string }) => mockReadTicketAsset(params),
}));
jest.mock('#src/ticketTracker/resolveTrackerSettings.ts', () => ({
	resolveTrackerSettings: ({ config, env }: { config: LightsoutConfig; env: NodeJS.ProcessEnv }): TrackerSettings | TrackerFailure => {
		const block = config['ticket-tracker'];

		if (block === undefined) {
			return { error: 'this command needs a `ticket-tracker` block in lightsout.config.json naming a provider and its credentials' };
		}

		const apiKey = env[block['api-key-env']] ?? '';

		return apiKey === ''
			? { error: `the tracker API key is missing: set the \`${block['api-key-env']}\` environment variable` }
			: { provider: 'linear', ticketPrefix: 'LO', team: 'LO', apiKey };
	},
}));
jest.mock('#src/ticketTracker/setTicketAttachment.ts', () => ({ setTicketAttachment: (params: AttachmentWrite) => mockSetTicketAttachment(params) }));
// -------------------------

/** The work order's label, which is also the branch the record names. */
const name = 'lo-140-multi';
const gates: LightsoutConfig['gates'] = { check: 'true', test: 'true', 'test-coverage': false };
const env = { LINEAR_API_KEY: 'lin_key' };

/** A single-plan record holding no plan 001, on which a person authorized hand-built work. */
const setupAuthorizedPlanlessRecord = async () => {
	const cwd = mkdtempSync(join(tmpdir(), 'lightsout-add-plan-hand-built-'));
	const recordPath = join(cwd, '.lightsout', 'work-orders', name, 'state.json');
	const record: WorkOrderState = {
		schemaVersion: 1,
		name,
		ticketRef: 'lo-140',
		branch: name,
		mode: WorkOrderMode.SinglePlan,
		plans: [],
		handBuiltShipAuthorization: { by: 'Ada Lovelace ada@example.com', at: '2026-02-01T00:00:00.000Z' },
		history: [{ at: '2026-01-01T00:00:00.000Z', kind: WorkOrderEventKind.PlanAdded, detail: 'the work order state was created' }],
	};

	await updateLocalWorkOrderState({ cwd, name, change: () => record });
	mockGetTicketAttachments.mockResolvedValue([]);
	// Narrowed to the two fields a publish reads: the rest of a tracker's issue
	// shape would say nothing about this function.
	mockGetTicketsByIdentifiers.mockResolvedValue([{ id: 'id-140', identifier: 'LO-140' } as TrackerTicket]);
	mockReadTicketAsset.mockResolvedValue({ error: 'no asset' });
	mockSetTicketAttachment.mockResolvedValue(undefined);

	return { recordPath, params: { cwd, name, slug: 'search-basics', config: { gates }, env } };
};

describe('addWorkOrderPlan', () => {
	test('withdraws a hand-built authorization when plan 001 is added, recording the withdrawal and saying so in the notice', async () => {
		const { recordPath, params } = await setupAuthorizedPlanlessRecord();

		const result = await addWorkOrderPlan(params);

		const written = JSON.parse(readFileSync(recordPath, 'utf8')) as WorkOrderState;
		const notice = 'notice' in result ? result.notice : undefined;

		expect(result).toEqual(expect.objectContaining({ address: 'lo-140-multi/001-search-basics' }));
		expect({
			planIds: written.plans.map((plan) => plan.id),
			carriesAuthorization: Object.hasOwn(written, 'handBuiltShipAuthorization'),
			lastKinds: written.history.slice(-2).map((event) => event.kind),
		}).toStrictEqual({
			planIds: ['001-search-basics'],
			carriesAuthorization: false,
			lastKinds: ['plan-added', 'hand-built-ship-authorization-withdrawn'],
		});
		expect(written.history.at(-1)?.detail).toContain('001-search-basics');
		expect(notice).toEqual(expect.stringMatching(/hand-built/));
		expect(notice).toEqual(expect.stringMatching(/withdr/));
	});
});
