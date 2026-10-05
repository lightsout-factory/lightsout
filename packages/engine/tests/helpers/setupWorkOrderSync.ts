import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { jest } from '@jest/globals';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import type { WorkOrderState } from '#src/contracts/workOrder/WorkOrderState.ts';
import { ticketTrackerConfigBlock } from '#tests/helpers/queueConfigBlock.ts';

type TrackerFailure = { error: string };
type TrackerTicket = { id: string; identifier: string };
type Attachment = { id: string; title: string; url: string };
type AttachmentWrite = { settings: unknown; ticketId: string; title: string; content: Buffer; contentType: string };
type SyncState = { schemaVersion: 1; recordSha256?: string; planMarkers: Record<string, string> };

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

/**
 * The tracker reads and writes, and the plan publish, a sync test doubles in
 * its own `jest.mock` block and hands here, so this fixture can arrange what
 * each one answers. They are the only calls that would touch the network; the
 * work order folder, the record, the sidecar and the plan folders stay real.
 */
interface WorkOrderSyncMocks {
	getTicketAttachments: jest.Mock<(params: { identifier: string }) => Promise<Attachment[] | TrackerFailure>>;
	getTicketsByIdentifiers: jest.Mock<(params: { identifiers: string[] }) => Promise<TrackerTicket[] | TrackerFailure>>;
	readTicketAsset: jest.Mock<(params: { url: string }) => Promise<string | TrackerFailure>>;
	setTicketAttachment: jest.Mock<(params: AttachmentWrite) => Promise<TrackerFailure | undefined>>;
	publishPlan: jest.Mock<(params: PublishParams) => Promise<PublishReport>>;
}

interface Params {
	mocks: WorkOrderSyncMocks;
	/** The work order's label, which is also its folder and its branch. */
	name: string;
	/** The ticket the work order belongs to, as the tracker names it. */
	ticketRef: string;
	/** The record in the primary checkout's work order folder. Absent writes no `state.json`. */
	local?: WorkOrderState;
	/** The record the ticket carries. Absent leaves the ticket with no `state.json` attachment. */
	published?: WorkOrderState;
	/** What every read of the ticket after the first answers, for a record another machine publishes mid-command. */
	publishedAfterFirstRead?: WorkOrderState;
	/** The sidecar naming the bytes this machine last published or restored. */
	syncState?: SyncState;
	/** Plan folders that exist in the primary checkout's work order folder. */
	planFolders?: string[];
	/** The marker hash a republish of a plan folder reports. */
	republishedMarker?: string;
	/** Whether an earlier divergence left its published copy beside the record. */
	publishedCopyOnDisk?: boolean;
}

const gates: LightsoutConfig['gates'] = { check: 'true', test: 'true', 'test-coverage': false };
/** The same block as `ticketTrackerConfigBlock`, typed: the fixture is the raw JSON shape, whose `provider` is a plain string. */
const trackerBlock: LightsoutConfig['ticket-tracker'] = { ...ticketTrackerConfigBlock, provider: 'linear' };
const config: LightsoutConfig = { gates, 'ticket-tracker': trackerBlock };
const env = { LINEAR_API_KEY: 'lin_key' };

const asFileText = ({ value }: { value: unknown }) => `${JSON.stringify(value, undefined, '\t')}\n`;

/**
 * A checkout outside any repository, so the shared state directory is its own
 * `.lightsout` and the work order folder is a path the test can name, with the
 * ticket's side of the story scripted on the tracker mocks.
 */
export const setupWorkOrderSync = ({
	mocks,
	name,
	ticketRef,
	local,
	published,
	publishedAfterFirstRead,
	syncState,
	planFolders = [],
	republishedMarker = createHash('sha256').update('a republished marker').digest('hex'),
	publishedCopyOnDisk = false,
}: Params) => {
	const cwd = mkdtempSync(join(tmpdir(), 'lightsout-ticket-sync-keep-local-'));
	const workOrderFolder = join(cwd, '.lightsout', 'work-orders', name);
	const progress: string[] = [];
	const bodies = [published, publishedAfterFirstRead ?? published].map((record) => (record === undefined ? undefined : asFileText({ value: record })));
	let reads = 0;

	mkdirSync(workOrderFolder, { recursive: true });

	if (local !== undefined) {
		writeFileSync(join(workOrderFolder, 'state.json'), asFileText({ value: local }));
	}

	if (syncState !== undefined) {
		writeFileSync(join(workOrderFolder, 'state-sync.json'), asFileText({ value: syncState }));
	}

	if (publishedCopyOnDisk && published !== undefined) {
		writeFileSync(join(workOrderFolder, 'state.published.json'), asFileText({ value: published }));
	}

	for (const planId of planFolders) {
		mkdirSync(join(workOrderFolder, 'plans', planId), { recursive: true });
		writeFileSync(join(workOrderFolder, 'plans', planId, 'plan.md'), `# ${planId}\n`);
	}

	mocks.getTicketAttachments.mockResolvedValue(
		published === undefined ? [] : [{ id: 'att-record', title: 'state.json', url: 'https://assets.example/ticket-record' }],
	);
	mocks.readTicketAsset.mockImplementation(async () => {
		const body = bodies[Math.min(reads, bodies.length - 1)];

		reads += 1;

		return body ?? { error: 'the ticket carries no state.json' };
	});
	mocks.getTicketsByIdentifiers.mockResolvedValue([{ id: 'id-140', identifier: ticketRef }]);
	mocks.setTicketAttachment.mockResolvedValue(undefined);
	mocks.publishPlan.mockResolvedValue({ ticketRef, published: ['003-held-here--plan.md'], stale: [], markerSha256: republishedMarker });

	return { cwd, workOrderFolder, progress, params: { cwd, name, config, env, onProgress: (message: string) => progress.push(message) } };
};
