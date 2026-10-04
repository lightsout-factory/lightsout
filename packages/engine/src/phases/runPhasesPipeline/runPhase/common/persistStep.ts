import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import type { StepRecord } from '#src/contracts/run/StepRecord.ts';
import { writeRunManifest } from '#src/runState/writeRunManifest.ts';

interface Params {
	cwd: string;
	manifest: RunManifest;
	index: number;
	record: StepRecord;
	patch?: Partial<RunManifest>;
}

export const persistStep = ({ cwd, manifest, index, record, patch }: Params): Promise<RunManifest> => {
	const steps = manifest.steps.map((step, position) => (position === index ? record : step));

	return writeRunManifest({ cwd, manifest: { ...manifest, ...patch, steps } });
};
