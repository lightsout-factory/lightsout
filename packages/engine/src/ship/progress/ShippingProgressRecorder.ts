import { mkdir, rename, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { writeJsonFile } from '#src/common/utils/writeJsonFile.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { ShippingProgress } from '#src/contracts/ship/ShippingProgress.ts';
import { ShippingStepId } from '#src/contracts/ship/ShippingStepId.ts';
import { getShippingProgressPath } from '#src/ship/progress/internal/common/utils/getShippingProgressPath.ts';

type ShippingStepRecord = ShippingProgress['steps'][number];

/** The steps a new attempt runs again. Sync is not among them: only a confirmed merge earns it, once. */
const attemptSteps: ShippingStepId[] = [ShippingStepId.Integrate, ShippingStepId.Push, ShippingStepId.PullRequest, ShippingStepId.Checks, ShippingStepId.Merge];

const pendingSteps = () => Object.values(ShippingStepId).map((id) => ({ id, status: RunStatus.Pending }));

const freshRecord = ({ branch, maxAttempts }: { branch: string; maxAttempts: number }) => {
	const now = new Date().toISOString();

	return { branch, attempt: 1, maxAttempts, pid: process.pid, startedAt: now, updatedAt: now, steps: pendingSteps() };
};

/**
 * The folder ignores everything in it, so the integration step's `git add -A`
 * never stages the record and its `git clean -fd` never deletes it, whatever the
 * repository's own ignore rules cover.
 */
const ensureIgnoreFile = async ({ folder }: { folder: string }) => {
	const ignorePath = join(folder, '.gitignore');
	const isFile = await stat(ignorePath).then(
		(found) => found.isFile(),
		() => false,
	);

	if (!isFile) {
		await writeFile(ignorePath, '*\n', 'utf8');
	}
};

/**
 * The path arrives unresolved because the constructor cannot await one; resolving
 * it inside the same `try` drops an unresolvable checkout just as an unwritable file is.
 */
const writeRecord = async ({ recordPath, record }: { recordPath: Promise<string | undefined>; record: ShippingProgress }) => {
	try {
		const path = await recordPath;

		if (path === undefined) {
			return;
		}

		const folder = dirname(path);

		await mkdir(folder, { recursive: true });
		await ensureIgnoreFile({ folder });
		await writeJsonFile({ path: `${path}.tmp`, value: record });
		await rename(`${path}.tmp`, path);
	} catch {
		// Swallowed on purpose, with no progress line: a ship's result, ordering and
		// output must never depend on this record. The next write tries again.
	}
};

interface ConstructorParams {
	/** The record lands in the primary checkout, resolved from this one. */
	cwd: string;
	branch: string;
	maxAttempts: number;
}

/**
 * Only `end` returns a promise: every other method queues its write and returns
 * at once, so a slow disk never delays a ship step.
 */
export class ShippingProgressRecorder {
	private readonly recordPath: Promise<string | undefined>;
	private record: ShippingProgress;
	private writes: Promise<void> = Promise.resolve();

	constructor({ cwd, branch, maxAttempts }: ConstructorParams) {
		this.recordPath = getShippingProgressPath({ cwd, branch });
		this.record = freshRecord({ branch, maxAttempts });
	}

	/** Attempt 1 replaces any record an earlier ship left; a later attempt keeps the same start time. */
	beginAttempt({ attempt }: { attempt: number }): void {
		const { branch, maxAttempts } = this.record;

		this.record =
			attempt === 1
				? freshRecord({ branch, maxAttempts })
				: {
						...this.record,
						attempt,
						steps: this.record.steps.map((step) => (attemptSteps.includes(step.id) ? { id: step.id, status: RunStatus.Pending } : step)),
					};
		this.save();
	}

	startStep({ step }: { step: ShippingStepId }): void {
		this.updateStep({ step, update: () => ({ id: step, status: RunStatus.Running, startedAt: new Date().toISOString() }) });
	}

	finishStep({ step, passed }: { step: ShippingStepId; passed: boolean }): void {
		const finishedAt = Date.now();

		this.updateStep({
			step,
			update: (current) => ({
				...current,
				status: passed ? RunStatus.Passed : RunStatus.Failed,
				durationMs: current.startedAt === undefined ? 0 : finishedAt - Date.parse(current.startedAt),
			}),
		});
	}

	noteProgress({ message }: { message: string }): void {
		this.record = { ...this.record, lastProgress: message };
		this.save();
	}

	/** Stamps the end, and resolves once every queued write has landed or been dropped. */
	end(): Promise<void> {
		this.record = { ...this.record, endedAt: new Date().toISOString() };
		this.save();

		return this.writes;
	}

	private updateStep({ step, update }: { step: ShippingStepId; update: (current: ShippingStepRecord) => ShippingStepRecord }) {
		this.record = { ...this.record, steps: this.record.steps.map((current) => (current.id === step ? update(current) : current)) };
		this.save();
	}

	/** Each write holds its own snapshot, because `record` is replaced rather than mutated. */
	private save() {
		const record: ShippingProgress = { ...this.record, pid: process.pid, updatedAt: new Date().toISOString() };
		const recordPath = this.recordPath;

		this.record = record;
		this.writes = this.writes.then(() => writeRecord({ recordPath, record }));
	}
}
