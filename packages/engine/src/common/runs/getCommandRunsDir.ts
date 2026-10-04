import { join } from 'node:path';
import { PipelineKind } from '#src/contracts/run/PipelineKind.ts';

/** Implement and phases share a folder, because a coordinator and the plan it sequences are one command's work. */
const commandFolders: Record<PipelineKind, string> = {
	[PipelineKind.Implement]: 'implement',
	[PipelineKind.Phases]: 'implement',
	[PipelineKind.Direct]: 'direct',
	[PipelineKind.Refactor]: 'refactor',
	[PipelineKind.Coverage]: 'coverage',
	[PipelineKind.Queue]: 'queue',
};

interface Params {
	/** The `.lightsout` folder the command folders sit in, already resolved to the primary checkout. */
	stateDir: string;
	pipeline: PipelineKind;
}

export const getCommandRunsDir = ({ stateDir, pipeline }: Params): string => join(stateDir, commandFolders[pipeline], 'runs');
