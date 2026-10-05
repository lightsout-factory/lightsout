import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { captureCommandOutput } from '#tests/helpers/captureCommandOutput.ts';
import { runDirFor } from '#tests/helpers/runDirFor.ts';

interface Params {
	manifests?: RunManifest[];
	/** A `.lightsout/lock.json` naming a holder and the run it holds the checkout for. */
	lock?: { pid: number; runId: string };
	/** A run directory whose manifest is not JSON at all. */
	unreadableRunId?: string;
	/** Leave out `.lightsout/runs`, as in a repo that never ran anything. */
	withoutRunsDir?: boolean;
}

/**
 * status renders whatever run state is on disk, so the arrangement is real
 * manifests (and a real `.lightsout/lock.json`) in a temp repo — read back
 * through the same readers the CLI uses, never stubbed.
 */
export const setupStatusRuns = ({ manifests = [], lock, unreadableRunId, withoutRunsDir = false }: Params = {}) => {
	const captured = captureCommandOutput();
	const cwd = mkdtempSync(join(tmpdir(), 'lightsout-status-command-'));

	if (!withoutRunsDir) {
		mkdirSync(join(cwd, '.lightsout', 'runs'), { recursive: true });
	}

	for (const manifest of manifests) {
		mkdirSync(runDirFor({ cwd, runId: manifest.runId }), { recursive: true });
		writeFileSync(join(runDirFor({ cwd, runId: manifest.runId }), 'manifest.json'), JSON.stringify(manifest));
	}

	if (unreadableRunId) {
		mkdirSync(runDirFor({ cwd, runId: unreadableRunId }), { recursive: true });
		writeFileSync(join(runDirFor({ cwd, runId: unreadableRunId }), 'manifest.json'), 'not json at all');
	}

	if (lock) {
		writeFileSync(join(cwd, '.lightsout', 'lock.json'), JSON.stringify({ ...lock, startedAt: '2026-01-01T00:00:01.000Z' }));
	}

	return { context: { flags: new Map<string, string | true>(), rest: [], cwd }, ...captured };
};
