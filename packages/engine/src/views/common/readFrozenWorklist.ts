import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { resolveRunDir } from '#src/common/runs/resolveRunDir.ts';
import { CoverageWorklist } from '#src/contracts/coverage/CoverageWorklist.ts';
import { RefactorWorklist } from '#src/contracts/refactor/RefactorWorklist.ts';
import { PipelineKind } from '#src/contracts/run/PipelineKind.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import type { FrozenWorklist } from '#src/views/common/types/FrozenWorklist.ts';

interface Params {
	cwd: string;
	manifest: RunManifest;
}

/**
 * The kind is decided before the file is opened, so a work-list that will not
 * parse still says which pipeline wrote it.
 */
export const readFrozenWorklist = async ({ cwd, manifest }: Params): Promise<FrozenWorklist> => {
	const raw = await readFile(join(await resolveRunDir({ cwd, runId: manifest.runId }), 'worklist.json'), 'utf8').catch(() => undefined);
	let parsed: unknown;

	try {
		parsed = raw === undefined ? undefined : JSON.parse(raw);
	} catch {
		parsed = undefined;
	}

	let frozen: FrozenWorklist;

	if (manifest.pipeline === PipelineKind.Coverage) {
		frozen = { kind: PipelineKind.Coverage, worklist: CoverageWorklist.safeParse(parsed).data };
	} else {
		frozen = { kind: PipelineKind.Refactor, worklist: RefactorWorklist.safeParse(parsed).data };
	}

	return frozen;
};
