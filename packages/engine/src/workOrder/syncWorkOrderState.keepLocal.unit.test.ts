import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
type SyncState = { schemaVersion: 1; recordSha256?: string; planMarkers: Record<string, string> };

/** A hash of the right shape for a field the contract reads as a SHA-256, told apart by what it was made from. */
const digestOf = ({ seed }: { seed: string }) => createHash('sha256').update(seed).digest('hex');

const asFileText = ({ value }: { value: unknown }) => `${JSON.stringify(value, undefined, '\t')}\n`;

const recordFrom = ({ result }: { result: SyncResult }) => ('record' in result ? result.record : undefined);
const errorFrom = ({ result }: { result: SyncResult }) => ('error' in result ? result.error : undefined);

/** The record as it stands in the primary checkout's work order folder. */
const localRecordOf = ({ workOrderFolder }: { workOrderFolder: string }): unknown => JSON.parse(readFileSync(join(workOrderFolder, 'state.json'), 'utf8'));

const syncStateOf = ({ workOrderFolder }: { workOrderFolder: string }) =>
	JSON.parse(readFileSync(join(workOrderFolder, 'state-sync.json'), 'utf8')) as SyncState;

/** Every upload of the work order state itself, in the order they were sent. */
const recordWrites = () => mockSetTicketAttachment.mock.calls.map(([write]) => write).filter((write) => write.title === 'state.json');

/** The abandoned pre-layout record of this same ticket, whose plan carries a title nothing should ever publish and no folder on disk. */
const prelayoutRecord = recordOf({ plans: [planOf({ id: '003-held-here', title: 'The title in the pre-layout folder' })] });

/**
 * The sync `setupSync` arranges, with `prelayoutRecord` left in the pre-layout
 * folder: a sync reading there would publish its title and republish nothing.
 */
const setupTicketFolderSync = ({ republishedMarker }: { republishedMarker: string }) => {
	const base = setupSync({
		local: recordOf({ plans: [planOf({ id: '003-held-here', title: 'The title in the work order folder' })] }),
		published: recordOf({
			plans: [planOf({ id: '003-held-here', title: 'The title the ticket carries', publishedMarker: digestOf({ seed: '003 as the ticket carries it' }) })],
		}),
		syncState: { schemaVersion: 1, planMarkers: {} },
		planFolders: ['003-held-here'],
		republishedMarker,
	});
	const prelayoutFolder = join(base.cwd, '.lightsout', 'plans', name);

	mkdirSync(prelayoutFolder, { recursive: true });
	writeFileSync(join(prelayoutFolder, 'state.json'), asFileText({ value: prelayoutRecord }));

	return { ...base, prelayoutFolder };
};

describe('syncWorkOrderState', () => {
	test('syncWorkOrderState: keeping the local copy publishes it over the published one, records its hash and removes state.published.json', async () => {
		const local = recordOf({ plans: [planOf({ id: '001-ticket-record', title: 'The title this machine holds' })] });
		const { params, workOrderFolder } = setupSync({
			local,
			published: recordOf({ plans: [planOf({ id: '001-ticket-record', title: 'The title another machine published' })] }),
			syncState: { schemaVersion: 1, recordSha256: digestOf({ seed: 'the bytes this machine last published' }), planMarkers: {} },
			publishedCopyOnDisk: true,
		});

		const result = await syncWorkOrderState({ ...params, keep: WorkOrderSyncKeep.Local });

		const [attached] = recordWrites();

		expect(result).toStrictEqual({ record: local });
		expect(attached).toStrictEqual({
			settings: expect.objectContaining({ provider: 'linear' }),
			ticketId: 'id-140',
			title: 'state.json',
			content: expect.any(Buffer),
			contentType: 'application/json',
		});
		expect(JSON.parse(attached?.content.toString('utf8') ?? 'null')).toStrictEqual(local);
		expect(syncStateOf({ workOrderFolder }).recordSha256).toBe(
			createHash('sha256')
				.update(attached?.content ?? Buffer.alloc(0))
				.digest('hex'),
		);
		expect(existsSync(join(workOrderFolder, 'state.published.json'))).toBe(false);
	});

	test('syncWorkOrderState: keeping the local copy republishes a divergent plan held locally and adopts the published marker for one it does not hold', async () => {
		const heldMarker = digestOf({ seed: '003 as the ticket carries it' });
		const elsewhereMarker = digestOf({ seed: '004 as the ticket carries it' });
		const republishedMarker = digestOf({ seed: '003 as this machine has just published it' });
		const { params, cwd, workOrderFolder } = setupSync({
			local: recordOf({ plans: [planOf({ id: '003-held-here' }), planOf({ id: '004-held-elsewhere' })] }),
			published: recordOf({
				plans: [planOf({ id: '003-held-here', publishedMarker: heldMarker }), planOf({ id: '004-held-elsewhere', publishedMarker: elsewhereMarker })],
			}),
			syncState: { schemaVersion: 1, planMarkers: {} },
			planFolders: ['003-held-here'],
			republishedMarker,
		});

		const result = await syncWorkOrderState({ ...params, keep: WorkOrderSyncKeep.Local });

		expect(mockPublishPlan).toHaveBeenCalledTimes(1);
		expect(mockPublishPlan).toHaveBeenCalledWith(expect.objectContaining({ cwd, name: 'lo-140-multi/003-held-here', titlePrefix: '003-held-here' }));
		expect(recordFrom({ result })?.plans).toEqual([
			expect.objectContaining({ id: '003-held-here', publishedMarker: republishedMarker }),
			expect.objectContaining({ id: '004-held-elsewhere', publishedMarker: elsewhereMarker }),
		]);
		expect(syncStateOf({ workOrderFolder }).planMarkers['003-held-here']).toBe(republishedMarker);
	});

	test('syncWorkOrderState: keeping the local copy publishes it as the first copy when the ticket carries none', async () => {
		const local = recordOf({ plans: [planOf({ id: '001-ticket-record' })] });
		const { params, workOrderFolder } = setupSync({ local, syncState: { schemaVersion: 1, planMarkers: {} } });

		const result = await syncWorkOrderState({ ...params, keep: WorkOrderSyncKeep.Local });

		const [attached] = recordWrites();

		expect(result).toStrictEqual({ record: local });
		expect(JSON.parse(attached?.content.toString('utf8') ?? 'null')).toStrictEqual(local);
		expect(mockPublishPlan).not.toHaveBeenCalled();
		expect(syncStateOf({ workOrderFolder }).recordSha256).toBe(
			createHash('sha256')
				.update(attached?.content ?? Buffer.alloc(0))
				.digest('hex'),
		);
	});

	test('syncWorkOrderState: keeping the local copy leaves the work order state alone when a divergent plan cannot be republished', async () => {
		const { params, workOrderFolder } = setupSync({
			local: recordOf({ plans: [planOf({ id: '003-held-here' })] }),
			published: recordOf({ plans: [planOf({ id: '003-held-here', publishedMarker: digestOf({ seed: '003 as the ticket carries it' }) })] }),
			syncState: { schemaVersion: 1, planMarkers: {} },
			planFolders: ['003-held-here'],
		});

		mockPublishPlan.mockResolvedValue({ published: [], stale: [], error: 'the tracker refused 003-held-here--plan.md' });

		const result = await syncWorkOrderState({ ...params, keep: WorkOrderSyncKeep.Local });

		expect(errorFrom({ result })).toContain('the tracker refused 003-held-here--plan.md');
		expect(mockSetTicketAttachment).not.toHaveBeenCalled();
		expect(syncStateOf({ workOrderFolder }).recordSha256).toBeUndefined();
	});

	test('syncWorkOrderState: keeping the local copy refuses when there is no local record', async () => {
		const { params, workOrderFolder } = setupSync({ published: recordOf({ plans: [planOf({ id: '001-ticket-record' })] }) });

		const result = await syncWorkOrderState({ ...params, keep: WorkOrderSyncKeep.Local });

		// The sentence has to name the ticket whose record is missing, so a human
		// reading it knows which branch to sync the other way instead.
		expect(result).toStrictEqual({ error: expect.stringContaining(name) });
		expect(errorFrom({ result })).toContain('state.json');
		expect(mockSetTicketAttachment).not.toHaveBeenCalled();
		expect(existsSync(join(workOrderFolder, 'state.json'))).toBe(false);
	});

	test('syncWorkOrderState: keeping the local copy never overwrites a published record newer than the one it read', async () => {
		const local = recordOf({ plans: [planOf({ id: '001-ticket-record', title: 'The title this machine holds' })] });
		const { params, workOrderFolder } = setupSync({
			local,
			published: recordOf({ plans: [planOf({ id: '001-ticket-record', title: 'The title this command read' })] }),
			publishedAfterFirstRead: recordOf({ plans: [planOf({ id: '001-ticket-record', title: 'The title another machine published next' })] }),
			syncState: { schemaVersion: 1, recordSha256: digestOf({ seed: 'the bytes this machine last published' }), planMarkers: {} },
		});

		const result = await syncWorkOrderState({ ...params, keep: WorkOrderSyncKeep.Local });

		expect(errorFrom({ result })).toContain('lightsout work-order sync');
		expect(mockSetTicketAttachment).not.toHaveBeenCalled();
		expect(localRecordOf({ workOrderFolder })).toStrictEqual(local);
	});

	test("syncWorkOrderState: a keep-local sync works entirely inside the ticket's own folder", async () => {
		const republishedMarker = digestOf({ seed: '003 as the work order folder has just published it' });
		const { workOrderFolder, prelayoutFolder, params } = setupTicketFolderSync({ republishedMarker });

		const result = await syncWorkOrderState({ ...params, keep: WorkOrderSyncKeep.Local });

		const [attached] = recordWrites();
		const kept = recordOf({ plans: [planOf({ id: '003-held-here', title: 'The title in the work order folder', publishedMarker: republishedMarker })] });

		expect(result).toStrictEqual({ record: kept });
		expect(JSON.parse(attached?.content.toString('utf8') ?? 'null')).toStrictEqual(kept);
		expect(mockPublishPlan).toHaveBeenCalledWith(expect.objectContaining({ name: 'lo-140-multi/003-held-here', titlePrefix: '003-held-here' }));
		expect(localRecordOf({ workOrderFolder })).toStrictEqual(kept);
		expect(syncStateOf({ workOrderFolder })).toStrictEqual({
			schemaVersion: 1,
			recordSha256: createHash('sha256')
				.update(attached?.content ?? Buffer.alloc(0))
				.digest('hex'),
			planMarkers: { '003-held-here': republishedMarker },
		});
		expect(JSON.parse(readFileSync(join(prelayoutFolder, 'state.json'), 'utf8'))).toStrictEqual(prelayoutRecord);
	});
});
