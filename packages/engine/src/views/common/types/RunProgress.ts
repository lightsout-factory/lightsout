import type { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { RunProgressRow } from '#src/views/common/types/RunProgressRow.ts';

export interface RunProgress {
	runId: string;
	/** First eight characters — the form every lightsout report prints and `--run` accepts. */
	shortId: string;
	title: string;
	status: RunStatus;
	/** A live process stands behind this run right now, as the family root's owner record answers — see `readRunLiveness`. */
	live: boolean;
	rows: RunProgressRow[];
	/** Wall time from run start to the manifest's last write, plus the time since that write when the run is live. */
	elapsedMs: number;
	changedFileCount: number;
	/** Run-wide API-equivalent cost; undefined for a driver that reports no usage. */
	costUsd: number | undefined;
	/** The last line the run narrated, or undefined when it has narrated nothing readable. */
	now: string | undefined;
	/** This run will ship and no ship result is on disk yet — what tells a watch its story is not over even though the run's own status is terminal. */
	awaitingShip: boolean;
	/** The command that continues this run — a phase child's names its coordinator's resume, because the sequence is what resumes. */
	resumeCommand: string;
}
