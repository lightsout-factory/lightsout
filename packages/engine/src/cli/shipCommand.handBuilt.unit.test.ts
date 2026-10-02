import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, jest, test } from '@jest/globals';
import { shipCommand } from '#src/cli/shipCommand.ts';
import { PlanProgress } from '#src/contracts/workOrder/PlanProgress.ts';
import { WorkOrderEventKind } from '#src/contracts/workOrder/WorkOrderEventKind.ts';
import { WorkOrderMode } from '#src/contracts/workOrder/WorkOrderMode.ts';
import { WorkOrderState } from '#src/contracts/workOrder/WorkOrderState.ts';
import { updateLocalWorkOrderState } from '#src/workOrder/updateLocalWorkOrderState.ts';
import { captureCommandOutput } from '#tests/helpers/captureCommandOutput.ts';
import { setupBranchRepo } from '#tests/helpers/setupBranchRepo.ts';
import { stubForgeOnPath } from '#tests/helpers/stubForgeOnPath.ts';

// Mocked Imports
// -------------------------
// The ship sequence is not stubbed out — it still runs for real against a real
// origin and a stubbed forge. The stand-in only records whether the command
// reached it, because a refused authorization must stop before any ship starts.
type RunShip = typeof import('#src/ship/runShip.ts').runShip;

const mockRunShip = jest.fn<RunShip>((params) => jest.requireActual<typeof import('#src/ship/runShip.ts')>('#src/ship/runShip.ts').runShip(params));

jest.mock('#src/ship/runShip.ts', () => ({ runShip: (params: Parameters<RunShip>[0]) => mockRunShip(params) }));
// -------------------------
// The authorization is written for real; the stand-in exists so one case can
// hand the command a publish failure no local-only record would ever produce.
type AuthorizeHandBuiltShip = typeof import('#src/workOrder/shipping/authorizeHandBuiltShip.ts').authorizeHandBuiltShip;

const mockAuthorizeHandBuiltShip = jest.fn<AuthorizeHandBuiltShip>();

jest.mock('#src/workOrder/shipping/authorizeHandBuiltShip.ts', () => ({
	authorizeHandBuiltShip: (params: Parameters<AuthorizeHandBuiltShip>[0]) => mockAuthorizeHandBuiltShip(params),
}));
// -------------------------

/** The work order's label, which is also the branch its record saves. */
const name = 'lo-60-ship';
const viewed = '{"number":41,"url":"https://forge.example/acme/repo/pull/41","title":"Add the ship command","headRefName":"lo-60-ship"}';
const firstEvent = { at: '2026-01-01T00:00:00.000Z', kind: WorkOrderEventKind.ModeChanged, detail: 'work order created in single-plan mode' };

/** A single-plan work order holding no plan 001 whose build from the ticket body failed, and nobody has authorized hand-built work. */
const failedBuildRecord: WorkOrderState = {
	schemaVersion: 1,
	name,
	ticketRef: 'LO-60',
	branch: name,
	mode: WorkOrderMode.SinglePlan,
	plans: [],
	ticketBodyBuild: { runId: 'run-body-1', progress: PlanProgress.Failed, startedAt: '2026-01-04T00:00:00.000Z', finishedAt: '2026-01-04T01:00:00.000Z' },
	history: [firstEvent],
};

/** The same work order, once a person has authorized shipping the work they built by hand. */
const authorizedRecord: WorkOrderState = {
	...failedBuildRecord,
	handBuiltShipAuthorization: { by: 'Grace Hopper grace@example.com', at: '2026-01-05T00:00:00.000Z' },
};

/** The same work order, once its build from the ticket body passed, so there is nothing to authorize. */
const passedBuildRecord: WorkOrderState = {
	...failedBuildRecord,
	ticketBodyBuild: { runId: 'run-body-2', progress: PlanProgress.Implemented, startedAt: '2026-01-04T00:00:00.000Z', finishedAt: '2026-01-04T01:00:00.000Z' },
};

/** A multiple-plan work order with its one plan implemented and no ship request. */
const multiplePlanRecord: WorkOrderState = {
	schemaVersion: 1,
	name,
	ticketRef: 'LO-60',
	branch: name,
	mode: WorkOrderMode.MultiplePlan,
	plans: [{ id: '001-ship-command', title: 'Add the ship command', progress: PlanProgress.Implemented, createdAt: '2026-01-01T00:00:00.000Z' }],
	history: [{ at: '2026-01-01T00:00:00.000Z', kind: WorkOrderEventKind.PlanAdded, detail: 'added plan 001-ship-command' }],
};

/**
 * A repo on branch `lo-60-ship` with a real origin, a forge that answers every
 * call, a local git identity, and the record the case names.
 *
 * No `ticket-tracker` block, so the record is local only: the authorization is
 * written to disk and never published, and a publish failure is arranged only
 * through the authorization's stand-in.
 */
const setupHandBuiltShip = async ({
	record = failedBuildRecord,
	handBuilt = true,
	checks = '[{"name":"unit","bucket":"pass"}]',
	email = 'ada@example.com',
	publishError,
	detached = false,
}: {
	/** The record that saves the branch; `null` for a branch no work order saves. */
	record?: WorkOrderState | null;
	/** Whether the command is run with `--hand-built`. */
	handBuilt?: boolean;
	checks?: string;
	/** The repository's own user.email; the empty string is how an unset key is arranged over any global one. */
	email?: string;
	/** A publish failure the authorization comes back carrying. */
	publishError?: string;
	/** Whether HEAD is detached, so it names no branch. */
	detached?: boolean;
} = {}) => {
	const captured = captureCommandOutput();

	stubForgeOnPath({
		responses: {
			'auth status': { exitCode: 0 },
			'pr list': { stdout: '[]' },
			'pr create': { stdout: 'https://forge.example/acme/repo/pull/41' },
			'pr edit': { exitCode: 0 },
			'pr view 41 --json number': { stdout: viewed },
			'pr view 41 --json headRefOid': { stdout: '{"headRefOid":"__HEAD__"}' },
			'pr view 41 --json state': {
				stdout: '{"state":"MERGED","mergeCommit":{"oid":"0f1e2d3c"},"headRefOid":"__HEAD__","mergeStateStatus":"CLEAN","reviewDecision":null}',
			},
			'pr checks': { stdout: checks },
			'pr merge': { exitCode: 0 },
		},
	});

	const passThrough = jest.requireActual<typeof import('#src/workOrder/shipping/authorizeHandBuiltShip.ts')>(
		'#src/workOrder/shipping/authorizeHandBuiltShip.ts',
	).authorizeHandBuiltShip;

	mockAuthorizeHandBuiltShip.mockImplementation(async (params) => {
		const authorized = await passThrough(params);

		return publishError === undefined || 'error' in authorized ? authorized : { ...authorized, publishError };
	});

	const { cwd } = setupBranchRepo({ branch: name, workOrder: false });
	const recordPath = join(cwd, '.lightsout', 'work-orders', name, 'state.json');

	if (record !== null) {
		const seeded = await updateLocalWorkOrderState({ cwd, name, change: () => record });

		if ('error' in seeded) {
			throw new Error(seeded.error);
		}
	}

	execSync(`git config user.name "Ada Lovelace" && git config user.email "${email}"`, { cwd, stdio: 'ignore' });
	writeFileSync(
		join(cwd, 'lightsout.config.json'),
		JSON.stringify({
			gates: { check: 'true', test: 'true', 'test-coverage': false },
			ship: { 'ticket-pattern': '^(?<ticket>lo-(?<number>\\d+))' },
		}),
	);
	// Committed, not just written: an untracked config would be the dirty tree
	// ship blocks on.
	execSync('git add -A && git -c user.name=t -c user.email=t@t commit -qm config', { cwd, stdio: 'ignore' });

	if (detached) {
		execSync('git checkout -q --detach', { cwd, stdio: 'ignore' });
	}

	const flags = new Map<string, string | true>(handBuilt ? [['hand-built', true]] : []);

	return {
		context: { flags, rest: [], cwd },
		cwd,
		recordPath,
		before: record === null ? undefined : readFileSync(recordPath, 'utf8'),
		shipResultPath: join(cwd, '.lightsout', 'work-orders', name, 'ship.json'),
		...captured,
	};
};

/** The record on disk, parsed by the schema every reader of it uses. */
const readRecord = ({ recordPath }: { recordPath: string }) => WorkOrderState.parse(JSON.parse(readFileSync(recordPath, 'utf8')));

describe('shipCommand --hand-built', () => {
	test('ships a single-plan work order holding no plan 001 with --hand-built, recording the authorization and a hand-built merge', async () => {
		const { context, recordPath, exitCodes } = await setupHandBuiltShip();

		await expect(shipCommand(context)).rejects.toThrow(/process\.exit/);

		const stored = readRecord({ recordPath });
		const shipped = stored.history.find((event) => event.kind === WorkOrderEventKind.Shipped);

		expect(stored.handBuiltShipAuthorization).toEqual({ by: 'Ada Lovelace ada@example.com', at: expect.any(String) });
		expect(shipped?.detail).toEqual(expect.stringContaining('hand-built'));
		expect(exitCodes).toStrictEqual([0]);
	});

	test('blocks the same work order without --hand-built, naming the flag and pushing nothing', async () => {
		const { context, cwd, recordPath, errors, exitCodes } = await setupHandBuiltShip({ handBuilt: false });

		await expect(shipCommand(context)).rejects.toThrow(/process\.exit/);

		const onOrigin = execSync(`git ls-remote --heads origin ${name}`, { cwd, encoding: 'utf8' });
		const stored = readRecord({ recordPath });

		expect(errors.some((line) => line.includes('ticket-not-authorized') && line.includes('--hand-built'))).toBe(true);
		// The record is consulted before anything leaves the machine.
		expect(onOrigin).toBe('');
		expect(Object.hasOwn(stored, 'handBuiltShipAuthorization')).toBe(false);
		expect(exitCodes).toStrictEqual([1]);
	});

	test('refuses --hand-built on a multiple-plan work order before any ship starts, writing no ship result', async () => {
		const { context, shipResultPath, errors, exitCodes } = await setupHandBuiltShip({ record: multiplePlanRecord });

		await expect(shipCommand(context)).rejects.toThrow(/process\.exit/);

		expect(errors.some((line) => line.includes(name) && line.includes('request-ship'))).toBe(true);
		expect(mockRunShip).not.toHaveBeenCalled();
		expect(existsSync(shipResultPath)).toBe(false);
		expect(exitCodes).toStrictEqual([1]);
	});

	test('refuses --hand-built naming the unset git identity key before any ship starts', async () => {
		const { context, recordPath, before, errors, exitCodes } = await setupHandBuiltShip({ email: '' });

		await expect(shipCommand(context)).rejects.toThrow(/process\.exit/);

		const after = readFileSync(recordPath, 'utf8');

		expect(errors.some((line) => line.includes('user.email'))).toBe(true);
		expect(mockRunShip).not.toHaveBeenCalled();
		expect(after).toBe(before);
		expect(exitCodes).toStrictEqual([1]);
	});

	test('refuses --hand-built on a branch no work order saves before any ship starts', async () => {
		const { context, errors, exitCodes } = await setupHandBuiltShip({ record: null });

		await expect(shipCommand(context)).rejects.toThrow(/process\.exit/);

		expect(errors.some((line) => line.includes(name))).toBe(true);
		expect(mockRunShip).not.toHaveBeenCalled();
		expect(exitCodes).toStrictEqual([1]);
	});

	test('blocks an authorized hand-built ship on a failing check with the same reason and checks an engine-built ship gets', async () => {
		const { context, errors, exitCodes } = await setupHandBuiltShip({
			record: authorizedRecord,
			handBuilt: false,
			checks: '[{"name":"unit","bucket":"fail"}]',
		});

		await expect(shipCommand(context)).rejects.toThrow(/process\.exit/);

		// The very lines shipCommand.unit.test.ts pins for an engine-built record on
		// the same failing check: a hand-built authorization skips no gate.
		expect(errors.some((line) => line.startsWith('ship blocked (checks-failed)'))).toBe(true);
		expect(errors).toContain('  checks: unit');
		expect(exitCodes).toStrictEqual([1]);
	});

	test('warns with the publish error and still ships when the authorization could not be published', async () => {
		const { context, errors, exitCodes } = await setupHandBuiltShip({ publishError: 'the tracker would not take the work order state' });

		await expect(shipCommand(context)).rejects.toThrow(/process\.exit/);

		expect(errors.some((line) => line.includes('the tracker would not take the work order state'))).toBe(true);
		expect(mockRunShip).toHaveBeenCalledTimes(1);
		expect(exitCodes).toStrictEqual([0]);
	});

	test('prints why nothing was recorded and ships from the ticket body when its build already passed', async () => {
		const { context, recordPath, logged, exitCodes } = await setupHandBuiltShip({ record: passedBuildRecord });

		await expect(shipCommand(context)).rejects.toThrow(/process\.exit/);

		const stored = readRecord({ recordPath });
		const shipped = stored.history.find((event) => event.kind === WorkOrderEventKind.Shipped);

		expect(logged.some((line) => line.includes('run-body-2') && line.includes('nothing was recorded'))).toBe(true);
		expect(Object.hasOwn(stored, 'handBuiltShipAuthorization')).toBe(false);
		expect(shipped?.detail).toEqual(expect.stringContaining('from the ticket body'));
		expect(exitCodes).toStrictEqual([0]);
	});

	test('refuses --hand-built when HEAD names no branch before any ship starts', async () => {
		const { context, recordPath, before, errors, exitCodes } = await setupHandBuiltShip({ detached: true });

		await expect(shipCommand(context)).rejects.toThrow(/process\.exit/);

		const after = readFileSync(recordPath, 'utf8');

		expect(errors.some((line) => line.includes('HEAD names no branch'))).toBe(true);
		expect(mockAuthorizeHandBuiltShip).not.toHaveBeenCalled();
		expect(mockRunShip).not.toHaveBeenCalled();
		expect(after).toBe(before);
		expect(exitCodes).toStrictEqual([1]);
	});
});
