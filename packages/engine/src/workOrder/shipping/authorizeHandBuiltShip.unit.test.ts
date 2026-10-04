import { existsSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { describe, expect, jest, test } from '@jest/globals';
import type { GitIdentity } from '#src/common/types/GitIdentity.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { PlanProgress } from '#src/contracts/workOrder/PlanProgress.ts';
import { WorkOrderMode } from '#src/contracts/workOrder/WorkOrderMode.ts';
import type { WorkOrderPlan } from '#src/contracts/workOrder/WorkOrderPlan.ts';
import type { WorkOrderState } from '#src/contracts/workOrder/WorkOrderState.ts';
import type { TrackerSettings } from '#src/ticketTracker/common/types/TrackerSettings.ts';
import { authorizeHandBuiltShip } from '#src/workOrder/shipping/authorizeHandBuiltShip.ts';
import { updateLocalWorkOrderState } from '#src/workOrder/updateLocalWorkOrderState.ts';
import { ticketTrackerConfigBlock } from '#tests/helpers/queueConfigBlock.ts';

// Mocked Imports
// -------------------------
// The tracker is the only seam mocked: the record is a real file in a temporary
// checkout, because what the authorization promises is which bytes reach disk.
type TrackerFailure = { error: string };
type TrackerTicket = { id: string; identifier: string };
type Attachment = { id: string; title: string; url: string };
type AttachmentWrite = { ticketId: string; title: string; content: Buffer; contentType: string };

const mockGetTicketsByIdentifiers = jest.fn<(params: { identifiers: string[] }) => Promise<TrackerTicket[] | TrackerFailure>>();
const mockSetTicketAttachment = jest.fn<(params: AttachmentWrite) => Promise<TrackerFailure | undefined>>();
const mockGetTicketAttachments = jest.fn<(params: { identifier: string }) => Promise<Attachment[] | TrackerFailure>>();
const mockReadTicketAsset = jest.fn<(params: { url: string }) => Promise<string | TrackerFailure>>();

jest.mock('#src/ticketTracker/getTicketAttachments.ts', () => ({
	getTicketAttachments: (params: { identifier: string }) => mockGetTicketAttachments(params),
}));
jest.mock('#src/ticketTracker/getTicketsByIdentifiers.ts', () => ({
	getTicketsByIdentifiers: (params: { identifiers: string[] }) => mockGetTicketsByIdentifiers(params),
}));
jest.mock('#src/ticketTracker/readTicketAsset.ts', () => ({ readTicketAsset: (params: { url: string }) => mockReadTicketAsset(params) }));
jest.mock('#src/ticketTracker/resolveTrackerSettings.ts', () => ({
	resolveTrackerSettings: ({ config, env }: { config: LightsoutConfig; env: NodeJS.ProcessEnv }): TrackerSettings | TrackerFailure =>
		config['ticket-tracker'] === undefined
			? { error: 'this command needs a `ticket-tracker` block in lightsout.config.json' }
			: { provider: 'linear', ticketPrefix: 'LO', team: 'LO', apiKey: env.LINEAR_API_KEY ?? '' },
}));
jest.mock('#src/ticketTracker/setTicketAttachment.ts', () => ({ setTicketAttachment: (params: AttachmentWrite) => mockSetTicketAttachment(params) }));
// -------------------------

/** The work order's label, which the ship command resolved from the branch below. */
const name = 'lo-191-hand-built';
/** The branch being shipped, set apart from the label so a sentence naming one cannot pass for the other. */
const branch = `feature/${name}`;
const gates: LightsoutConfig['gates'] = { check: 'true', test: 'true', 'test-coverage': false };
const mergeCommit = 'a1b2c3d4e5f6';
const isoTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const fullIdentity: GitIdentity = { name: 'Dana Reviewer', email: 'dana@example.com' };

type TicketBodyBuild = NonNullable<WorkOrderState['ticketBodyBuild']>;

const buildOf = ({ progress }: { progress: TicketBodyBuild['progress'] }): TicketBodyBuild => ({
	runId: 'run-191',
	progress,
	startedAt: '2026-09-01T00:00:00.000Z',
	...(progress === PlanProgress.Implementing ? {} : { finishedAt: '2026-09-01T01:00:00.000Z' }),
});

const planOneOf = ({ excludedFor }: { excludedFor?: string } = {}): WorkOrderPlan => ({
	id: '001-hand-built',
	title: 'Hand built',
	progress: PlanProgress.Ready,
	createdAt: '2026-09-01T00:00:00.000Z',
	...(excludedFor === undefined ? {} : { exclusion: { at: '2026-09-02T00:00:00.000Z', reason: excludedFor, implementationRemoved: false } }),
});

/** A single-plan record holding no plan 001 unless a row says otherwise. */
const recordOf = (overrides: Partial<WorkOrderState> = {}): WorkOrderState => ({
	schemaVersion: 1,
	name,
	ticketRef: 'LO-191',
	branch,
	mode: WorkOrderMode.SinglePlan,
	plans: [],
	history: [],
	...overrides,
});

/** The authorization an earlier `lightsout ship --hand-built` left on the record. */
const earlierAuthorization = { by: 'Riley Owner riley@example.com', at: '2026-09-03T00:00:00.000Z' };

/**
 * A checkout outside any repository holding the given record, or none at all,
 * written by the store itself. Without `tracker` the config has no tracker
 * block, so the record is local only; with it, the tracker serves the ticket
 * with nothing published and refuses every attach.
 */
const setupHandBuiltShip = async ({ record = recordOf(), tracker = false }: { record?: WorkOrderState | 'none'; tracker?: boolean } = {}) => {
	const cwd = mkdtempSync(join(tmpdir(), 'lightsout-hand-built-ship-'));
	const recordPath = join(cwd, '.lightsout', 'work-orders', name, 'state.json');

	if (record !== 'none') {
		await updateLocalWorkOrderState({ cwd, name, change: () => record });
	}

	mockGetTicketsByIdentifiers.mockResolvedValue([{ id: 'id-191', identifier: 'LO-191' }]);
	mockGetTicketAttachments.mockResolvedValue([]);
	mockReadTicketAsset.mockResolvedValue({ error: 'no asset' });
	mockSetTicketAttachment.mockResolvedValue({ error: 'the tracker rejected the attachment' });

	const config: LightsoutConfig = tracker ? { gates, 'ticket-tracker': { ...ticketTrackerConfigBlock, provider: 'linear' } } : { gates };
	const env: NodeJS.ProcessEnv = tracker ? { LINEAR_API_KEY: 'lin_key' } : {};
	const readBytes = () => (existsSync(recordPath) ? readFileSync(recordPath, 'utf8') : undefined);
	const readRecord = () => JSON.parse(readFileSync(recordPath, 'utf8')) as WorkOrderState;

	return { before: readBytes(), readBytes, readRecord, params: { cwd, name, branch, config, env } };
};

/** Every non-test `.ts` file under `packages/engine/src`, as a path relative to it with forward slashes. */
const srcDir = join(__dirname, '..', '..');

const listNonTestSources = () =>
	readdirSync(srcDir, { recursive: true, encoding: 'utf8' })
		.filter((path) => path.endsWith('.ts') && !path.endsWith('.test.ts'))
		.map((path) => path.split(sep).join('/'));

describe('authorizeHandBuiltShip', () => {
	test.each([
		{ ticketBodyBuild: undefined },
		{ ticketBodyBuild: buildOf({ progress: PlanProgress.Implementing }) },
		{ ticketBodyBuild: buildOf({ progress: PlanProgress.Failed }) },
	])(
		'records who authorized hand-built work and when, with one hand-built-ship-authorized event, whether the build is absent, implementing or failed',
		async ({ ticketBodyBuild }) => {
			const { params, readRecord } = await setupHandBuiltShip({ record: recordOf(ticketBodyBuild === undefined ? {} : { ticketBodyBuild }) });

			const result = await authorizeHandBuiltShip({ ...params, identity: fullIdentity });

			const stored = readRecord();

			expect({
				authorization: stored.handBuiltShipAuthorization,
				events: stored.history.filter((event) => event.kind === 'hand-built-ship-authorized').length,
				result,
			}).toEqual({
				authorization: { by: 'Dana Reviewer dana@example.com', at: expect.stringMatching(isoTime) },
				events: 1,
				result: expect.objectContaining({ record: stored }),
			});
		},
	);

	test.each([
		{ record: recordOf({ mode: WorkOrderMode.MultiplePlan }), names: ['lightsout work-order request-ship', name] },
		{
			record: recordOf({
				mode: WorkOrderMode.MultiplePlan,
				plans: [planOneOf()],
				shipRequest: { planIds: ['001-hand-built'], requestedAt: '2026-09-02T00:00:00.000Z' },
			}),
			names: ['lightsout work-order request-ship', name],
		},
		{ record: recordOf({ plans: [planOneOf()] }), names: [name] },
		{ record: recordOf({ plans: [{ ...planOneOf(), progress: PlanProgress.Implemented }] }), names: [name, 'plan 001'] },
		{ record: recordOf({ plans: [planOneOf({ excludedFor: 'the ticket body says it all' })] }), names: [name] },
		{ record: recordOf({ shipped: { at: '2026-09-04T00:00:00.000Z', planIds: [], mergeCommit } }), names: [name, mergeCommit] },
		{ record: 'none' as const, names: [branch, 'lightsout ship'] },
	])(
		"refuses a multiple-plan work order, one holding plan 001 even when it is excluded, a shipped one and a missing one, leaving the record's bytes untouched",
		async ({ record, names }) => {
			const { params, before, readBytes } = await setupHandBuiltShip({ record });

			const result = await authorizeHandBuiltShip({ ...params, identity: fullIdentity });

			const error = 'error' in result ? result.error : '';

			expect({
				refused: 'error' in result,
				oneSentence: !error.includes('\n'),
				named: names.map((part) => error.includes(part)),
				unchanged: readBytes() === before,
			}).toStrictEqual({ refused: true, oneSentence: true, named: names.map(() => true), unchanged: true });
		},
	);

	test.each([
		{ identity: { email: 'dana@example.com' }, unset: ['user.name'], set: ['user.email'] },
		{ identity: { name: 'Dana Reviewer' }, unset: ['user.email'], set: ['user.name'] },
		{ identity: {}, unset: ['user.name', 'user.email'], set: [] },
	])("refuses naming each git identity key that is unset, leaving the record's bytes untouched", async ({ identity, unset, set }) => {
		const { params, before, readBytes } = await setupHandBuiltShip({ record: recordOf({ ticketBodyBuild: buildOf({ progress: PlanProgress.Failed }) }) });

		const result = await authorizeHandBuiltShip({ ...params, identity });

		const error = 'error' in result ? result.error : '';

		expect({
			refused: 'error' in result,
			named: unset.map((key) => error.includes(key)),
			namedWhileSet: set.map((key) => error.includes(key)),
			unchanged: readBytes() === before,
		}).toStrictEqual({
			refused: true,
			named: unset.map(() => true),
			namedWhileSet: set.map(() => false),
			unchanged: true,
		});
	});

	test('writes nothing and asks for no git identity when the build from the ticket body already passed', async () => {
		const { params, readRecord } = await setupHandBuiltShip({ record: recordOf({ ticketBodyBuild: buildOf({ progress: PlanProgress.Implemented }) }) });
		const unchanged = readRecord();

		const result = await authorizeHandBuiltShip({ ...params, identity: {} });

		const stored = readRecord();

		expect({ result, stored, carriesAuthorization: Object.hasOwn(stored, 'handBuiltShipAuthorization') }).toEqual({
			result: { record: unchanged, notice: expect.any(String) },
			stored: unchanged,
			carriesAuthorization: false,
		});
	});

	test('keeps an authorization already recorded without asking for a git identity and appends no event', async () => {
		const { params, readRecord } = await setupHandBuiltShip({
			record: recordOf({ ticketBodyBuild: buildOf({ progress: PlanProgress.Failed }), handBuiltShipAuthorization: earlierAuthorization }),
		});

		const result = await authorizeHandBuiltShip({ ...params, identity: {} });

		const stored = readRecord();

		expect({ result, authorization: stored.handBuiltShipAuthorization, history: stored.history }).toEqual({
			result: expect.objectContaining({ record: stored, notice: expect.stringContaining('Riley Owner riley@example.com') }),
			authorization: { by: 'Riley Owner riley@example.com', at: '2026-09-03T00:00:00.000Z' },
			history: [],
		});
	});

	test('returns the record it wrote locally with the publish error when the tracker would not take it', async () => {
		const { params, readRecord } = await setupHandBuiltShip({ tracker: true });

		const result = await authorizeHandBuiltShip({ ...params, identity: fullIdentity });

		const stored = readRecord();

		expect({ result, authorization: stored.handBuiltShipAuthorization }).toEqual({
			result: expect.objectContaining({ record: stored, publishError: expect.stringContaining('the tracker rejected the attachment') }),
			authorization: { by: 'Dana Reviewer dana@example.com', at: expect.stringMatching(isoTime) },
		});
	});

	test('is named by the ship command alone, so no queue, implement or guard path can write the authorization', () => {
		const sources = listNonTestSources();

		const naming = sources
			.filter((path) => path !== 'workOrder/shipping/authorizeHandBuiltShip.ts')
			.filter((path) => /\bauthorizeHandBuiltShip\b/.test(readFileSync(join(srcDir, path), 'utf8')));

		expect(naming).toStrictEqual(['cli/shipCommand.ts']);
	});
});
