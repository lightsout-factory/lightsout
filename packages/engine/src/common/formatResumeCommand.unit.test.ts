import { describe, expect, test } from '@jest/globals';
import { formatResumeCommand } from '#src/common/formatResumeCommand.ts';
import { PipelineKind } from '#src/contracts/run/PipelineKind.ts';

describe('formatResumeCommand', () => {
	test('names the door each pipeline resumes through, with the run id filled in', () => {
		const runId = 'a1b2c3d4';

		expect(Object.values(PipelineKind).map((pipeline) => [pipeline, formatResumeCommand({ pipeline, runId })])).toStrictEqual([
			[PipelineKind.Implement, 'lightsout resume --run a1b2c3d4'],
			[PipelineKind.Refactor, 'lightsout refactor --run a1b2c3d4'],
			[PipelineKind.Phases, 'lightsout resume --run a1b2c3d4'],
			[PipelineKind.Coverage, 'lightsout test-coverage-to-threshold --run a1b2c3d4'],
			[PipelineKind.Queue, 'lightsout queue (a restart resumes parked tickets first)'],
			[PipelineKind.Direct, 'lightsout resume --run a1b2c3d4'],
		]);
	});
});
