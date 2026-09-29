import { PipelineKind } from '@lightsout/engine/contracts';
import { RunCommand } from '#src/features/runs/common/constants/RunCommand.ts';

const commandsByPipeline: Record<string, RunCommand> = {
	[PipelineKind.Implement]: RunCommand.Implement,
	[PipelineKind.Phases]: RunCommand.ImplementPhased,
	[PipelineKind.Refactor]: RunCommand.Refactor,
	[PipelineKind.Coverage]: RunCommand.Coverage,
};

interface Params {
	pipeline: string;
}

/** An unknown pipeline reads as itself, since a newer engine may record a value this app does not know. */
export const getRunCommand = ({ pipeline }: Params): string => commandsByPipeline[pipeline] ?? pipeline;
