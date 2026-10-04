import { messageOf } from '#src/common/messageOf.ts';
import type { Driver } from '#src/common/types/Driver.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { Permissions } from '#src/contracts/Permissions.ts';
import type { DoctorCheck } from '#src/doctor/runDoctor/common/types/DoctorCheck.ts';
import { getDriver } from '#src/drivers/getDriver/getDriver.ts';

/** The adapter file whose parse has to be re-captured when a harness renames its token fields. */
const usageAdapters: Record<string, string> = {
	'claude-code': 'packages/engine/src/drivers/getDriver/createClaudeCodeDriver/createClaudeCodeDriver.ts',
	omp: 'packages/engine/src/drivers/getDriver/createPiDriver/createPiDriver.ts',
	pi: 'packages/engine/src/drivers/getDriver/createPiDriver/createPiDriver.ts',
};

const holdsFiniteNumber = ({ value }: { value: unknown }) =>
	typeof value === 'object' && value !== null && Object.values(value).some((member) => typeof member === 'number' && Number.isFinite(member));

/**
 * Deliberately generic rather than a copy of the adapter's zod schema: a copy
 * would pass exactly when the adapter passes, and so detect nothing.
 */
const carriesStreamedUsage = ({ event, depth }: { event: unknown; depth: number }): boolean => {
	// Claude Code nests its counts at `message.usage`; bounded so a cyclic event cannot recurse for ever.
	const maxEventDepth = 6;

	if (depth > maxEventDepth || typeof event !== 'object' || event === null) {
		return false;
	}

	return Object.entries(event).some(
		([key, value]) => (key === 'usage' && holdsFiniteNumber({ value })) || carriesStreamedUsage({ event: value, depth: depth + 1 }),
	);
};

/**
 * Settled and streamed usage are read separately because they fail apart, and a
 * process killed at its ceiling has only the streamed one. A throw comes back as
 * a value so a paid probe is never lost to an escaped error.
 */
const probeHarnessUsage = async ({ cwd, harness, driver }: { cwd: string; harness: string; driver?: Driver }) => {
	// An agent call, not a `--version` probe: long enough for a one-word answer
	// on a cold harness, short enough that a hang does not hold the doctor.
	const timeoutMs = 120_000;
	let streamed = false;

	try {
		const result = await (driver ?? getDriver({ name: harness })).invoke({
			prompt: 'Reply with the single word: ok. Do not use any tools.',
			cwd,
			permissions: Permissions.ReadOnly,
			timeoutMs,
			onEvent: (event) => {
				streamed = streamed || carriesStreamedUsage({ event, depth: 0 });
			},
		});

		return { streamed, usage: result.usage };
	} catch (error) {
		return { error: messageOf({ error }) };
	}
};

type Probed = Awaited<ReturnType<typeof probeHarnessUsage>>;

/** Both readings present is the only pass: settled-only leaves a timed-out spawn with nothing to recover. */
const verdictOf = ({ harness, probed }: { harness: string; probed: Probed }): DoctorCheck => {
	const adapter = usageAdapters[harness] ?? `the ${harness} driver`;
	let verdict: Omit<DoctorCheck, 'id'>;

	if ('error' in probed) {
		verdict = {
			status: 'fail',
			detail: `the ${harness} probe call did not finish: ${probed.error}`,
			fix: `run \`${harness === 'claude-code' ? 'claude' : harness} --version\` and confirm the harness is installed and logged in, then run the probe again`,
		};
	} else if (probed.usage === undefined) {
		verdict = {
			status: 'fail',
			detail: `${harness} reported no tokens at all — a settled call came back with no usage`,
			fix: `${harness} has most likely renamed its token fields — re-capture its real output and update the parse in ${adapter}`,
		};
	} else if (!probed.streamed) {
		verdict = {
			status: 'warn',
			detail: `${harness} reported ${probed.usage.inputTokens} in / ${probed.usage.outputTokens} out when the call settled, but streamed no token counts on the way`,
			fix: `a process killed at its time limit never settles, so it would recover nothing — re-capture ${harness}'s real output and update the streamed-usage parse in ${adapter}`,
		};
	} else {
		verdict = {
			status: 'pass',
			detail: `${harness} reported ${probed.usage.inputTokens} in / ${probed.usage.outputTokens} out when the call settled, and streamed token counts as it ran`,
		};
	}

	return { id: 'harness-usage', ...verdict };
};

interface Params {
	cwd: string;
	config: LightsoutConfig;
	/** Test seam for the throwaway agent call — defaults to the driver the config names. */
	driver?: Driver;
}

/**
 * Opt-in, because it spends one real agent call. The suite pins each adapter
 * against hand-captured output, which goes stale silently when a harness changes
 * its format; this catches that. Codex is not probed: its driver reads no usage.
 */
export const checkHarnessUsage = async ({ cwd, config, driver }: Params): Promise<DoctorCheck> => {
	const harness = config.harness ?? 'claude-code';

	if (harness === 'codex') {
		return {
			id: 'harness-usage',
			status: 'note',
			detail: 'codex reads no usage by design, so it is not probed — codex plans report no tokens',
		};
	}

	return verdictOf({ harness, probed: await probeHarnessUsage({ cwd, harness, driver }) });
};
