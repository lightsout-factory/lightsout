import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { RefactorBatch } from '#src/contracts/refactor/RefactorBatch.ts';
import { runDirFor } from '#tests/helpers/runDirFor.ts';

interface Params {
	/** The repo to write the run into; a fresh temp directory when omitted. */
	cwd?: string;
	runId?: string;
	/** `null` writes a manifest with no `pipeline` field at all — how runs from before the discriminator existed are stored. */
	pipeline?: string | null;
	batches: RefactorBatch[];
	reports?: Record<string, unknown>;
	worklistJson?: string;
	/** Raw manifest text, for the run whose manifest cannot be read at all. */
	manifestJson?: string;
	/** Batch ids the manifest holds no step record for — how a run stopped before a batch ran is stored. */
	unrecordedBatchIds?: string[];
}

/**
 * A repo with one persisted run: a frozen work-list plus the manifest step
 * records that answered it. `pipeline` and `plan` are what decide whether the
 * report treats the run as its material at all.
 */
export const setupRefactorRun = ({
	cwd = mkdtempSync(join(tmpdir(), 'lightsout-health-')),
	runId = 'run-01',
	pipeline = 'refactor',
	batches,
	reports = {},
	worklistJson,
	manifestJson,
	unrecordedBatchIds = [],
}: Params) => {
	const runDir = runDirFor({ cwd, runId });

	mkdirSync(runDir, { recursive: true });
	writeFileSync(join(runDir, 'worklist.json'), worklistJson ?? JSON.stringify({ at: '2026-01-01T00:00:00.000Z', path: '.', all: false, batches }));
	writeFileSync(
		join(runDir, 'manifest.json'),
		manifestJson ??
			JSON.stringify({
				runId,
				createdAt: '2026-01-01T00:00:00.000Z',
				updatedAt: '2026-01-01T00:00:00.000Z',
				plan: join('.lightsout', 'runs', runId, 'worklist.json'),
				...(pipeline === null ? {} : { pipeline }),
				harness: 'stub',
				status: 'passed',
				currentStep: null,
				steps: batches
					.filter((entry) => !unrecordedBatchIds.includes(entry.id))
					.map((entry) => ({
						id: entry.id,
						status: 'passed',
						attempts: 1,
						...(Object.hasOwn(reports, entry.id) ? { report: reports[entry.id] } : {}),
					})),
				changedFiles: [],
			}),
	);

	return cwd;
};
