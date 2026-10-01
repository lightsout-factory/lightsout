import { PipelineKind } from '#src/contracts/run/PipelineKind.ts';

interface Params {
	pipeline: PipelineKind;
	runId: string;
}

const resumeDoor = 'lightsout resume --run <id>';

// The whole instruction rather than a command word, because the doors do not
// take the same flags: `queue` has no `--run`, since re-running it is the resume.
const resumeCommandByPipeline: Record<PipelineKind, string> = {
	[PipelineKind.Implement]: resumeDoor,
	[PipelineKind.Phases]: resumeDoor,
	[PipelineKind.Refactor]: 'lightsout refactor --run <id>',
	[PipelineKind.Coverage]: 'lightsout test-coverage-to-threshold --run <id>',
	[PipelineKind.Queue]: 'lightsout queue (a restart resumes parked tickets first)',
	[PipelineKind.Direct]: resumeDoor,
};

/** The command that continues a run of this pipeline, so every hint names the door that pipeline's runs actually come back through. */
export const formatResumeCommand = ({ pipeline, runId }: Params): string => resumeCommandByPipeline[pipeline].replaceAll('<id>', runId);
