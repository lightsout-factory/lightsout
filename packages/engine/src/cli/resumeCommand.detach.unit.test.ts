import { describe, expect, jest, test } from '@jest/globals';
import { parseFlags } from '#src/cli/common/args/parseFlags.ts';
import { resumeCommand } from '#src/cli/resumeCommand.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import type { PipelineResult } from '#src/pipeline/PipelineResult.ts';
import { manifestOf, runId, setupResume } from '#tests/helpers/setupResume.ts';

// Mocked Imports
// -------------------------
// The detached launch spawns a real engine and waits on it; it is tested beside
// itself. What this file pins is what resume hands it, and when it refuses to.
interface LaunchParams {
	cwd: string;
	command: string;
	args: string[];
	runId: string;
	relayMailbox?: string;
	pollMs?: number;
}

const mockLaunchDetached = jest.fn<(params: LaunchParams) => Promise<number>>();

jest.mock('#src/cli/internal/common/detach/launchDetached.ts', () => ({
	launchDetached: (params: LaunchParams) => mockLaunchDetached(params),
}));
// -------------------------
// The single-plan pipeline spawns a harness; doubling it lets the case read the
// environment and the run the pipeline was handed at the moment it starts.
interface PipelineParams {
	cwd: string;
	existing?: RunManifest;
}

const mockRunPipelineOrFailFast = jest.fn<(params: PipelineParams) => Promise<PipelineResult>>();

jest.mock('#src/cli/internal/common/utils/runPipelineOrFailFast.ts', () => ({
	runPipelineOrFailFast: (params: PipelineParams) => mockRunPipelineOrFailFast(params),
}));
// -------------------------

/** The phased coordinator a seeded phase child belongs to. */
const coordinatorRunId = 'run-coordinator-01';

/** The shortened id a run's report prints, which a reader retypes into --run. */
const shortRunId = runId.slice(0, 8);

/** Thrown by the doubled pipeline once it has recorded what it was started with, so the command stops there. */
const pipelineReached = 'the resumed pipeline started';

/**
 * A stopped implement run, and three detached resumes typed against it: one by
 * its shortened id, one with no --run, and one whose --run names no run. Each
 * context's `rest` is the arguments as typed, as main.ts hands them over.
 */
const setupDetachedResume = () => {
	mockLaunchDetached.mockResolvedValue(0);

	const seeded = setupResume({ manifest: manifestOf({ pipeline: 'implement' }) });
	const contextOf = (args: string[]) => ({ flags: parseFlags({ args }), rest: args, cwd: seeded.cwd });

	return {
		...seeded,
		shortIdArgs: ['--detach', '--run', shortRunId],
		shortIdContext: contextOf(['--detach', '--run', shortRunId]),
		noRunContext: contextOf(['--detach']),
		unknownIdContext: contextOf(['--detach', '--run', 'ghost']),
	};
};

/** A stopped implement run resumed with a value after --detach, which the flag never takes. */
const setupValuedDetach = () => {
	mockLaunchDetached.mockResolvedValue(0);

	const args = ['--detach', 'later', '--run', runId];
	const seeded = setupResume({ args, manifest: manifestOf({ pipeline: 'implement' }) });

	return { ...seeded, context: { ...seeded.context, rest: args } };
};

/** A failed phase child of a phased coordinator, resumed detached by its own id. */
const setupDetachedPhaseChild = () => {
	mockLaunchDetached.mockResolvedValue(0);

	const args = ['--detach', '--run', runId];
	const seeded = setupResume({ args, manifest: manifestOf({ pipeline: 'implement', parentRunId: coordinatorRunId }) });

	return { ...seeded, context: { ...seeded.context, rest: args } };
};

/**
 * A detached child: the parent's run id stands in its environment, and its own
 * --run names the stopped run it resumes. The doubled pipeline records what the
 * environment and the handed run were when it started, then stops the command.
 */
const setupDetachedChild = () => {
	const seen: { launchVariable: string | undefined; resumedRunId: string | undefined }[] = [];

	jest.replaceProperty(process, 'env', { ...process.env, LIGHTSOUT_RUN_ID: runId });
	mockRunPipelineOrFailFast.mockImplementation(({ existing }) => {
		seen.push({ launchVariable: process.env.LIGHTSOUT_RUN_ID, resumedRunId: existing?.runId });

		return Promise.reject(new Error(pipelineReached));
	});

	const args = ['--run', runId];
	const seeded = setupResume({ args, manifest: manifestOf({ pipeline: 'implement' }) });

	return { ...seeded, context: { ...seeded.context, rest: args }, seen };
};

describe('resumeCommand', () => {
	test('resumeCommand: --detach launches the resume under the full id the typed --run resolves to, and refuses an unusable id before launching', async () => {
		const { cwd, shortIdArgs, shortIdContext, noRunContext, unknownIdContext, logged, errors, exitCodes } = setupDetachedResume();

		const byShortId = resumeCommand(shortIdContext);
		await expect(byShortId).rejects.toThrow(/process\.exit/);
		const withoutRun = resumeCommand(noRunContext);
		await expect(withoutRun).rejects.toThrow(/process\.exit/);
		const byUnknownId = resumeCommand(unknownIdContext);
		await expect(byUnknownId).rejects.toThrow(/process\.exit/);

		// only the usable id launches, under the full id; the other two are refused
		// in the parent, before anything is spawned
		expect({ launches: mockLaunchDetached.mock.calls, logged, errors, exitCodes }).toEqual({
			launches: [[{ cwd, command: 'resume', args: shortIdArgs, runId }]],
			logged: [],
			errors: [
				expect.stringMatching(/^lightsout — deterministic engine for coding agents/),
				`no run matching 'ghost' — list the runs this repo has with: lightsout status`,
			],
			exitCodes: [0, 1, 1],
		});
	});

	test('resumeCommand: --detach on a phase child points at its coordinator instead of launching a resume no handshake could confirm', async () => {
		const { context, errors, exitCodes } = setupDetachedPhaseChild();

		const resumed = resumeCommand(context);

		await expect(resumed).rejects.toThrow(/process\.exit/);
		expect({
			launched: mockLaunchDetached.mock.calls.length,
			namesCoordinatorResume: errors.join('\n').includes(`lightsout resume --run ${coordinatorRunId} --detach`),
			exitCodes,
		}).toStrictEqual({ launched: 0, namesCoordinatorResume: true, exitCodes: [1] });
	});

	test('resumeCommand: a valued --detach prints the usage text and exits 1 without launching', async () => {
		const { context, logged, errors, exitCodes } = setupValuedDetach();

		const resumed = resumeCommand(context);

		await expect(resumed).rejects.toThrow(/process\.exit/);
		expect({ launched: mockLaunchDetached.mock.calls.length, logged, errors, exitCodes }).toEqual({
			launched: 0,
			logged: [],
			errors: [expect.stringMatching(/^lightsout — deterministic engine for coding agents/)],
			exitCodes: [1],
		});
	});

	test('resumeCommand: a detached child strips the launch variable and resumes its own --run id', async () => {
		const { context, logged, seen } = setupDetachedChild();

		const resumed = resumeCommand(context);

		await expect(resumed).rejects.toThrow(pipelineReached);
		expect({ resumingLine: logged[0], seen, launched: mockLaunchDetached.mock.calls.length }).toStrictEqual({
			resumingLine: `lightsout: resuming run ${runId} (was: failed, plan: ghost.md)`,
			seen: [{ launchVariable: undefined, resumedRunId: runId }],
			launched: 0,
		});
	});
});
