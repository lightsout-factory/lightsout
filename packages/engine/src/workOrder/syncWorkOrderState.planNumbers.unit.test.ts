import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, jest, test } from '@jest/globals';
import { WorkOrderSyncKeep } from '#src/common/constants/WorkOrderSyncKeep.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { PlanProgress } from '#src/contracts/workOrder/PlanProgress.ts';
import { WorkOrderEventKind } from '#src/contracts/workOrder/WorkOrderEventKind.ts';
import { WorkOrderMode } from '#src/contracts/workOrder/WorkOrderMode.ts';
import type { WorkOrderState } from '#src/contracts/workOrder/WorkOrderState.ts';
import { syncWorkOrderState } from '#src/workOrder/syncWorkOrderState.ts';
import { setupWorkOrderSync } from '#tests/helpers/setupWorkOrderSync.ts';

// Mocked Imports
// -------------------------
// The tracker barrel is the seam this file keeps: replacing it is what lets a
// resolved divergence be asserted end to end without a network. The ticket
// folder, the record, the sidecar and the plan folders are real files in a
// temporary checkout, because which copy a keep choice acts on is a disk read.
type TrackerFailure = { error: string };
type TrackerTicket = { id: string; identifier: string };
type Attachment = { id: string; title: string; url: string };
type AttachmentWrite = { settings: unknown; ticketId: string; title: string; content: Buffer; contentType: string };

const mockGetTicketAttachments = jest.fn<(params: { identifier: string }) => Promise<Attachment[] | TrackerFailure>>();
const mockGetTicketsByIdentifiers = jest.fn<(params: { identifiers: string[] }) => Promise<TrackerTicket[] | TrackerFailure>>();
const mockReadTicketAsset = jest.fn<(params: { url: string }) => Promise<string | TrackerFailure>>();
const mockSetTicketAttachment = jest.fn<(params: AttachmentWrite) => Promise<TrackerFailure | undefined>>();

jest.mock('#src/ticketTracker/getTicketAttachments.ts', () => ({
	getTicketAttachments: (params: { identifier: string }) => mockGetTicketAttachments(params),
}));
jest.mock('#src/ticketTracker/getTicketsByIdentifiers.ts', () => ({
	getTicketsByIdentifiers: (params: { identifiers: string[] }) => mockGetTicketsByIdentifiers(params),
}));
jest.mock('#src/ticketTracker/readTicketAsset.ts', () => ({ readTicketAsset: (params: { url: string }) => mockReadTicketAsset(params) }));
jest.mock('#src/ticketTracker/resolveTrackerSettings.ts', () => ({
	resolveTrackerSettings: ({ config, env }: { config: LightsoutConfig; env: NodeJS.ProcessEnv }) =>
		config['ticket-tracker'] === undefined
			? { error: 'this command needs a `ticket-tracker` block in lightsout.config.json naming a provider and its credentials' }
			: { provider: 'linear', ticketPrefix: 'LO', team: 'LO', apiKey: env.LINEAR_API_KEY ?? '' },
}));
jest.mock('#src/ticketTracker/setTicketAttachment.ts', () => ({ setTicketAttachment: (params: AttachmentWrite) => mockSetTicketAttachment(params) }));
// -------------------------
// Only the plan publish is replaced. The plan module's other exports stay real,
// so the plan folder a republish is decided on is looked up on disk exactly as
// it is in a run.
interface PublishParams {
	cwd: string;
	name: string;
	config: LightsoutConfig;
	env: NodeJS.ProcessEnv;
	onProgress: (message: string) => void;
	titlePrefix?: string;
}

interface PublishReport {
	ticketRef?: string;
	published: string[];
	stale: string[];
	error?: string;
	markerSha256?: string;
}

const mockPublishPlan = jest.fn<(params: PublishParams) => Promise<PublishReport>>();

jest.mock('#src/plan/publish/publishPlan/publishPlan.ts', () => ({ publishPlan: (params: PublishParams) => mockPublishPlan(params) }));
// -------------------------

/** The work order's label, which is also the branch every record below names. */
const name = 'lo-140-multi';
const ticketRef = 'LO-140';
/** The first event of every record here, so a carried plan's event is the last one. */
const firstEvent = { at: '2026-09-01T09:00:00.000Z', kind: WorkOrderEventKind.PlanAdded, detail: 'added plan 001-ticket-record' };

const planOf = ({ id, title = `Plan ${id}`, publishedMarker }: { id: string; title?: string; publishedMarker?: string }): WorkOrderState['plans'][number] => ({
	id,
	title,
	progress: PlanProgress.Ready,
	createdAt: '2026-09-01T09:00:00.000Z',
	...(publishedMarker === undefined ? {} : { publishedMarker }),
});

const recordOf = ({ plans, history = [firstEvent] }: { plans: WorkOrderState['plans']; history?: WorkOrderState['history'] }): WorkOrderState => ({
	schemaVersion: 1,
	name,
	ticketRef,
	branch: name,
	mode: WorkOrderMode.MultiplePlan,
	plans,
	history,
});

/** The sync `setupWorkOrderSync` arranges for this work order, scripted on this file's tracker mocks. */
const setupSync = (arrangement: Omit<Parameters<typeof setupWorkOrderSync>[0], 'mocks' | 'name' | 'ticketRef'>) =>
	setupWorkOrderSync({
		mocks: {
			getTicketAttachments: mockGetTicketAttachments,
			getTicketsByIdentifiers: mockGetTicketsByIdentifiers,
			readTicketAsset: mockReadTicketAsset,
			setTicketAttachment: mockSetTicketAttachment,
			publishPlan: mockPublishPlan,
		},
		name,
		ticketRef,
		...arrangement,
	});

type SyncResult = { record: WorkOrderState } | { error: string };

const recordFrom = ({ result }: { result: SyncResult }) => ('record' in result ? result.record : undefined);
const errorFrom = ({ result }: { result: SyncResult }) => ('error' in result ? result.error : undefined);

/** The record as it stands in the primary checkout's work order folder. */
const localRecordOf = ({ workOrderFolder }: { workOrderFolder: string }): unknown => JSON.parse(readFileSync(join(workOrderFolder, 'state.json'), 'utf8'));

describe('syncWorkOrderState', () => {
	test('syncWorkOrderState: both keep choices carry a plan only one copy holds so no number is lost or reused', async () => {
		const keepingPublished = setupSync({
			local: recordOf({ plans: [planOf({ id: '001-ticket-record' }), planOf({ id: '003-queue-order' })] }),
			published: recordOf({ plans: [planOf({ id: '001-ticket-record' })] }),
		});

		const published = await syncWorkOrderState({ ...keepingPublished.params, keep: WorkOrderSyncKeep.Published });

		const keepingLocal = setupSync({
			local: recordOf({ plans: [planOf({ id: '001-ticket-record' })] }),
			published: recordOf({ plans: [planOf({ id: '001-ticket-record' }), planOf({ id: '004-ship-guard' })] }),
		});

		const local = await syncWorkOrderState({ ...keepingLocal.params, keep: WorkOrderSyncKeep.Local });

		const carriedFromLocal = recordFrom({ result: published })?.history.at(-1);
		const carriedFromPublished = recordFrom({ result: local })?.history.at(-1);

		expect(recordFrom({ result: published })?.plans.map((plan) => plan.id)).toStrictEqual(['001-ticket-record', '003-queue-order']);
		expect(carriedFromLocal).toStrictEqual({ at: expect.any(String), kind: 'plan-added', detail: expect.stringContaining('003-queue-order') });
		expect(carriedFromLocal?.detail).toContain('local');
		expect(recordFrom({ result: local })?.plans.map((plan) => plan.id)).toStrictEqual(['001-ticket-record', '004-ship-guard']);
		expect(carriedFromPublished).toStrictEqual({ at: expect.any(String), kind: 'plan-added', detail: expect.stringContaining('004-ship-guard') });
		expect(carriedFromPublished?.detail).toContain('published');
	});

	test('syncWorkOrderState: refuses a keep choice when the two copies used one number for different plans', async () => {
		const clash = {
			local: recordOf({ plans: [planOf({ id: '001-ticket-record' }), planOf({ id: '003-queue-order' })] }),
			published: recordOf({ plans: [planOf({ id: '001-ticket-record' }), planOf({ id: '003-ship-request' })] }),
		};
		const keepingPublished = setupSync(clash);

		const published = await syncWorkOrderState({ ...keepingPublished.params, keep: WorkOrderSyncKeep.Published });

		const keepingLocal = setupSync(clash);

		const local = await syncWorkOrderState({ ...keepingLocal.params, keep: WorkOrderSyncKeep.Local });

		expect(errorFrom({ result: published })).toContain('003-queue-order');
		expect(errorFrom({ result: published })).toContain('003-ship-request');
		expect(errorFrom({ result: local })).toContain('003-queue-order');
		expect(errorFrom({ result: local })).toContain('003-ship-request');
		expect(localRecordOf({ workOrderFolder: keepingPublished.workOrderFolder })).toStrictEqual(clash.local);
		expect(localRecordOf({ workOrderFolder: keepingLocal.workOrderFolder })).toStrictEqual(clash.local);
		expect(mockSetTicketAttachment).not.toHaveBeenCalled();
	});
});
