import { resolve } from 'node:path';
import { describe, expect, jest, test } from '@jest/globals';
import { queueCommand } from '#src/cli/queueCommand.ts';
import type { QueueDrainReport } from '#src/queue/common/types/QueueDrainReport.ts';
import type { QueueFailure } from '#src/queue/common/types/QueueFailure.ts';
import type { QueueSettings } from '#src/queue/common/types/QueueSettings.ts';
import type { TrackerFailure } from '#src/ticketTracker/common/types/TrackerFailure.ts';
import type { TrackerSettings } from '#src/ticketTracker/common/types/TrackerSettings.ts';
import { captureCommandOutput } from '#tests/helpers/captureCommandOutput.ts';
import { queueSettingsFixture } from '#tests/helpers/queueSettingsFixture.ts';
import { setupConsumerRepo } from '#tests/helpers/setupConsumerRepo.ts';
import { trackerSettingsFixture } from '#tests/helpers/trackerSettingsFixture.ts';

/**
 * `--detach` and the detached child it launches.
 *
 * A sibling of `queueCommand.unit.test.ts` rather than more cases in it: that
 * file states the config the command refuses and the relay it opens, while
 * every case here is about which process drains — the short-lived parent that
 * hands the command to a detached launch, or the child that drains under the id
 * its parent minted.
 */

// Mocked Imports
// -------------------------
// The detached launch spawns a real engine and waits on its records — covered by
// its own tests. What this command owns is what it hands that launch, and that
// the parent touches nothing the child will own.
type LaunchDetachedParams = Parameters<typeof import('#src/cli/internal/common/detach/launchDetached.ts').launchDetached>[0];
const mockLaunchDetached = jest.fn<(params: LaunchDetachedParams) => Promise<number>>();

jest.mock('#src/cli/internal/common/detach/launchDetached.ts', () => ({
	launchDetached: (params: LaunchDetachedParams) => mockLaunchDetached(params),
}));
// -------------------------
// The drain spawns harnesses and talks to a tracker — the queue module's entry
// point, covered by its own tests.
type RunQueueParams = Parameters<typeof import('#src/queue/runQueue.ts').runQueue>[0];
const mockRunQueue = jest.fn<(params: RunQueueParams) => Promise<QueueDrainReport | QueueFailure>>();

jest.mock('#src/queue/runQueue.ts', () => ({ runQueue: (params: RunQueueParams) => mockRunQueue(params) }));
// -------------------------
const mockEmptyRelayMailbox = jest.fn<(params: { directory: string }) => Promise<void>>();

jest.mock('#src/queue/relay/emptyRelayMailbox.ts', () => ({ emptyRelayMailbox: (params: { directory: string }) => mockEmptyRelayMailbox(params) }));
// -------------------------
const mockResolveQueueSettings = jest.fn<() => QueueSettings | QueueFailure>();
const mockResolveTrackerSettings = jest.fn<() => TrackerSettings | TrackerFailure>();

jest.mock('#src/queue/startup/resolveQueueSettings.ts', () => ({ resolveQueueSettings: () => mockResolveQueueSettings() }));
jest.mock('#src/ticketTracker/resolveTrackerSettings.ts', () => ({ resolveTrackerSettings: () => mockResolveTrackerSettings() }));
// -------------------------

/**
 * A relay constructor whose instances only close. A function declaration, so it
 * is already in scope when the hoisted factories below run, before this
 * module's own `const` bindings are initialised.
 */
function mockClosingRelay() {
	return class {
		close() {
			return undefined;
		}
	};
}

jest.mock('#src/queue/relay/TerminalQuestionRelay.ts', () => ({ TerminalQuestionRelay: mockClosingRelay() }));
jest.mock('#src/queue/relay/FileQuestionRelay.ts', () => ({ FileQuestionRelay: mockClosingRelay() }));
// -------------------------

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * A repo whose config carries a ship block, invoked as typed: `rest` is the
 * command's own arguments, `flags` what the parser made of them.
 */
const setupQueueCommand = ({ rest, flags }: { rest: string[]; flags: [string, string | true][] }) => {
	const captured = captureCommandOutput();
	const cwd = setupConsumerRepo({ config: { ship: { 'ticket-pattern': '^(?<ticket>[a-z]+-\\d+)' } } });

	mockResolveQueueSettings.mockReturnValue(queueSettingsFixture());
	mockResolveTrackerSettings.mockReturnValue(trackerSettingsFixture());
	mockRunQueue.mockResolvedValue({ outcomes: [], leftBehind: [] });
	mockEmptyRelayMailbox.mockResolvedValue(undefined);
	mockLaunchDetached.mockResolvedValue(0);

	return { context: { flags: new Map<string, string | true>(flags), rest, cwd }, cwd, ...captured };
};

/** A foreground invocation, as a detached parent's child receives it or as a user types it, with the launch variable set or absent. */
const setupDrainingQueueCommand = ({ launchedRunId }: { launchedRunId: string | undefined }) => {
	const setup = setupQueueCommand({ rest: [], flags: [] });

	if (launchedRunId === undefined) {
		delete process.env.LIGHTSOUT_RUN_ID;
	} else {
		process.env.LIGHTSOUT_RUN_ID = launchedRunId;
	}

	return setup;
};

describe('queueCommand', () => {
	test.each([
		{
			typed: 'no --file-relay',
			rest: ['--detach'],
			flags: [['detach', true]] as [string, string | true][],
			launchedArgs: ['--detach', '--file-relay'],
			mailbox: ['.lightsout', 'queue', 'relay'],
		},
		{
			typed: '--file-relay box',
			rest: ['--detach', '--file-relay', 'box'],
			flags: [
				['detach', true],
				['file-relay', 'box'],
			] as [string, string | true][],
			launchedArgs: ['--detach', '--file-relay', 'box'],
			mailbox: ['box'],
		},
	])(
		'queueCommand: --detach implies the file relay and names the mailbox the child will watch, without touching it',
		async ({ rest, flags, launchedArgs, mailbox }) => {
			const { context, cwd, exitCodes } = setupQueueCommand({ rest, flags });

			await expect(queueCommand(context)).rejects.toThrow(/process\.exit/);

			const launched = mockLaunchDetached.mock.calls.map(([params]) => params);

			expect({
				launched,
				runIdIsUuid: uuid.test(launched[0]?.runId ?? ''),
				emptied: mockEmptyRelayMailbox.mock.calls.length,
				drained: mockRunQueue.mock.calls.length,
				exitCodes,
			}).toEqual({
				launched: [expect.objectContaining({ cwd, command: 'queue', args: launchedArgs, relayMailbox: resolve(cwd, ...mailbox) })],
				runIdIsUuid: true,
				emptied: 0,
				drained: 0,
				exitCodes: [0],
			});
		},
	);

	test('queueCommand: a valued --detach prints the usage text and exits 1 without launching or draining', async () => {
		const { context, errors, exitCodes } = setupQueueCommand({ rest: ['--detach', 'later'], flags: [['detach', 'later']] });

		await expect(queueCommand(context)).rejects.toThrow(/process\.exit/);

		expect({
			launched: mockLaunchDetached.mock.calls.length,
			emptied: mockEmptyRelayMailbox.mock.calls.length,
			drained: mockRunQueue.mock.calls.length,
			errors,
			exitCodes,
		}).toEqual({
			launched: 0,
			emptied: 0,
			drained: 0,
			errors: [expect.stringMatching(/^lightsout — deterministic engine for coding agents/)],
			exitCodes: [1],
		});
	});

	test.each([
		{ started: 'with LIGHTSOUT_RUN_ID', launchedRunId: '6f1c2b8e-3d4a-4e5f-9a0b-1c2d3e4f5a6b', recordEmptyDrain: true },
		{ started: 'without LIGHTSOUT_RUN_ID', launchedRunId: undefined, recordEmptyDrain: false },
	])(
		"queueCommand: a detached child drains under its parent's id and always records its queue run, a foreground drain does not",
		async ({ launchedRunId, recordEmptyDrain }) => {
			const { context } = setupDrainingQueueCommand({ launchedRunId });

			await expect(queueCommand(context)).rejects.toThrow(/process\.exit/);

			const drained = mockRunQueue.mock.calls.map(([params]) => params);

			expect({
				drained,
				variableLeft: Object.hasOwn(process.env, 'LIGHTSOUT_RUN_ID'),
				launched: mockLaunchDetached.mock.calls.length,
			}).toEqual({
				drained: [expect.objectContaining({ runId: launchedRunId ?? expect.stringMatching(uuid), recordEmptyDrain })],
				variableLeft: false,
				launched: 0,
			});
		},
	);
});
