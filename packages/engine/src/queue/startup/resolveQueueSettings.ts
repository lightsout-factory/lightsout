import type { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';
import type { QueueFailure } from '#src/queue/common/types/QueueFailure.ts';
import type { QueueSettings } from '#src/queue/common/types/QueueSettings.ts';
import { parseDurationMs } from '#src/queue/internal/common/utils/parseDurationMs.ts';
import { resolveLifecycleSettings } from '#src/ticketLifecycle/resolveLifecycleSettings.ts';

interface Params {
	config: LightsoutConfig;
}

/**
 * Answers only for the `queue` block: a missing block and a missing tracker key
 * are different things to fix, so `resolveTrackerSettings` names its own.
 *
 * Status names and planning-status labels resolve in `resolveLifecycleSettings`,
 * because the command edge writes both without a queue.
 */
export const resolveQueueSettings = ({ config }: Params): QueueSettings | QueueFailure => {
	const queue = config.queue;

	if (queue === undefined) {
		return { error: '`lightsout queue` needs a `queue` block in lightsout.config.json naming max-parallel' };
	}

	const lifecycle = resolveLifecycleSettings({ config });

	if ('error' in lifecycle) {
		return lifecycle;
	}

	const workerTimeoutMs = parseDurationMs({ value: queue['worker-timeout'] ?? '4h', key: 'queue.worker-timeout' });

	if (typeof workerTimeoutMs !== 'number') {
		return workerTimeoutMs;
	}

	const questionTimeoutMs = parseDurationMs({ value: queue['question-timeout'] ?? '1h', key: 'queue.question-timeout' });

	if (typeof questionTimeoutMs !== 'number') {
		return questionTimeoutMs;
	}

	return {
		lifecycle,
		maxParallel: queue['max-parallel'],
		setup: config.worktree?.setup,
		branchTemplate: queue['branch-template'] ?? '{ticket}-{slug}',
		decisionsHeading: queue['decisions-heading'] ?? '## Decisions',
		workerTimeoutMs,
		questionTimeoutMs,
		parkedLabel: queue['parked-label'],
	};
};
