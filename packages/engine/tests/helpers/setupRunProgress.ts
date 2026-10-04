import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import type { ShipStatus } from '#src/contracts/ship/ShipStatus.ts';
import { runDirFor } from '#tests/helpers/runDirFor.ts';
import { runProgressManifestOf } from '#tests/helpers/runProgressManifestOf.ts';
import { seedWorkOrderRecord } from '#tests/helpers/seedWorkOrderRecord.ts';

/**
 * A real repo holding the run's own evidence — its progress log and, when the
 * case wants one, a filed ship result. The manifest is passed in rather than
 * read back, exactly as `statusCommand` passes the one it already read.
 */
export const setupRunProgress = ({
	manifest = runProgressManifestOf(),
	narrated = [],
	shipResult,
}: {
	manifest?: RunManifest;
	narrated?: string[];
	shipResult?: { branch: string; status: ShipStatus };
} = {}) => {
	const cwd = mkdtempSync(join(tmpdir(), 'lightsout-run-progress-'));

	mkdirSync(runDirFor({ cwd, runId: manifest.runId }), { recursive: true });

	if (narrated.length > 0) {
		writeFileSync(
			join(runDirFor({ cwd, runId: manifest.runId }), 'progress.jsonl'),
			narrated.map((message) => `${JSON.stringify({ at: '2026-01-01T00:00:00.000Z', message })}\n`).join(''),
			'utf8',
		);
	}

	if (shipResult) {
		// The ship result is filed in the work order whose record stores the branch.
		seedWorkOrderRecord({ cwd, name: shipResult.branch });
		writeFileSync(
			join(cwd, '.lightsout', 'work-orders', shipResult.branch, 'ship.json'),
			JSON.stringify({ status: shipResult.status, branch: shipResult.branch, failingChecks: [] }),
			'utf8',
		);
	}

	return { cwd, manifest };
};
