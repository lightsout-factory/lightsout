import { existsSync, mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, jest, test } from '@jest/globals';
import { finishImplementRun } from '#src/cli/internal/common/implementRun/finishImplementRun.ts';
import { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { PipelineResult } from '#src/pipeline/PipelineResult.ts';
import { captureCommandOutput } from '#tests/helpers/captureCommandOutput.ts';
import { runDirFor } from '#tests/helpers/runDirFor.ts';
import { manifestOf } from '#tests/helpers/setupResume.ts';

// Mocked Imports
// -------------------------
// The report card has its own tests; here it is a fixed set of lines, so what
// was printed and what was saved can be compared to one known answer.
const mockRenderResult = jest.fn<(params: { result: PipelineResult; cwd: string }) => Promise<string[]>>();

jest.mock('#src/cli/internal/common/render/renderResult.ts', () => ({
	renderResult: (params: { result: PipelineResult; cwd: string }) => mockRenderResult(params),
}));
// -------------------------
// Ship has its own tests too; here it only answers the code the command ends with.
interface ShipParams {
	config: LightsoutConfig;
	cwd: string;
	result: PipelineResult;
	shipFlag: boolean;
	noShipFlag: boolean;
	env: NodeJS.ProcessEnv;
}

const mockShipAfterImplement = jest.fn<(params: ShipParams) => Promise<number>>();

jest.mock('#src/cli/internal/common/utils/shipAfterImplement.ts', () => ({
	shipAfterImplement: (params: ShipParams) => mockShipAfterImplement(params),
}));
// -------------------------

const renderedLines = ['', 'run       run-fini · PASSED', 'plan      feature.md', '', 'evidence  .lightsout/runs/run-finish-1/'];

/**
 * A run that ended with the given status, its folder on disk unless `withFolder`
 * is false, and a ship that answers `shipCode`. `parentRunId` names a
 * coordinator whose folder is made beside the run's own.
 */
const setupFinish = ({
	status = RunStatus.Passed,
	ok = status === RunStatus.Passed,
	error,
	shipCode = 0,
	parentRunId,
	withFolder = true,
}: {
	status?: RunStatus;
	ok?: boolean;
	error?: string;
	shipCode?: number;
	parentRunId?: string;
	withFolder?: boolean;
} = {}) => {
	const captured = captureCommandOutput();
	const cwd = mkdtempSync(join(tmpdir(), 'lightsout-finish-implement-'));
	const runId = 'run-finish-1';
	const runDir = runDirFor({ cwd, runId });
	const parentRunDir = parentRunId === undefined ? undefined : runDirFor({ cwd, runId: parentRunId });

	for (const dir of [withFolder ? runDir : undefined, parentRunDir]) {
		if (dir !== undefined) {
			mkdirSync(dir, { recursive: true });
		}
	}

	mockRenderResult.mockResolvedValue(renderedLines);
	mockShipAfterImplement.mockResolvedValue(shipCode);

	const config = LightsoutConfig.parse({ gates: { check: 'true', test: 'true', 'test-coverage': false } });
	const result: PipelineResult = { ok, manifest: manifestOf({ runId, status, ...(parentRunId === undefined ? {} : { parentRunId }) }), error };
	const flags = new Map<string, string | true>();
	const readSavedReport = ({ dir }: { dir: string }) => {
		const path = join(dir, 'report.json');

		return existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as unknown) : undefined;
	};

	return { ...captured, cwd, runId, runDir, parentRunDir, config, result, flags, readSavedReport };
};

describe('finishImplementRun', () => {
	test.each([
		{ status: RunStatus.Failed, shipCode: 1, stdoutTail: [] as string[], stderr: ['\nthe implement step failed its gates'] },
		{ status: RunStatus.PausedRateLimit, shipCode: 2, stdoutTail: ['\nthe implement step failed its gates'], stderr: [] as string[] },
	])("prints the report, then the run's error on stderr — or stdout when the run is paused", async ({ status, shipCode, stdoutTail, stderr }) => {
		const { config, cwd, result, flags, logged, errors } = setupFinish({ status, shipCode, error: 'the implement step failed its gates' });

		await expect(finishImplementRun({ config, cwd, result, flags })).rejects.toThrow(/process\.exit/);

		expect({ logged, errors }).toStrictEqual({ logged: [...renderedLines, ...stdoutTail], errors: stderr });
	});

	test('saves the printed report with the exit code it then exits with', async () => {
		const { config, cwd, result, flags, logged, exitCodes, runDir, readSavedReport } = setupFinish();

		await expect(finishImplementRun({ config, cwd, result, flags })).rejects.toThrow(/process\.exit/);

		const saved = readSavedReport({ dir: runDir });

		expect({ logged, saved, exitCodes }).toEqual({
			logged: renderedLines,
			saved: { lines: renderedLines, exitCode: 0, finishedAt: expect.any(String) },
			exitCodes: [0],
		});
	});

	test("saves a failed run's error as the last lines of its report", async () => {
		const { config, cwd, result, flags, runDir, readSavedReport } = setupFinish({
			status: RunStatus.Failed,
			shipCode: 1,
			error: 'the implement step failed its gates',
		});

		await expect(finishImplementRun({ config, cwd, result, flags })).rejects.toThrow(/process\.exit/);

		const saved = readSavedReport({ dir: runDir });

		expect(saved).toEqual({
			lines: [...renderedLines, '', 'the implement step failed its gates'],
			exitCode: 1,
			finishedAt: expect.any(String),
		});
	});

	test('a blocked ship is saved as exit 1, the code the process ends with', async () => {
		const { config, cwd, result, flags, exitCodes, runDir, readSavedReport } = setupFinish({ shipCode: 1 });

		await expect(finishImplementRun({ config, cwd, result, flags })).rejects.toThrow(/process\.exit/);

		const saved = readSavedReport({ dir: runDir });

		expect({ saved, exitCodes }).toEqual({ saved: expect.objectContaining({ exitCode: 1 }), exitCodes: [1] });
	});

	test("saves a phase child's report in its family root's folder", async () => {
		const { config, cwd, result, flags, runDir, parentRunDir, readSavedReport } = setupFinish({ parentRunId: 'run-coordinator-1' });

		await expect(finishImplementRun({ config, cwd, result, flags })).rejects.toThrow(/process\.exit/);

		const savedInRoot = parentRunDir === undefined ? undefined : readSavedReport({ dir: parentRunDir });
		const savedInChild = readSavedReport({ dir: runDir });

		expect({ savedInRoot, savedInChild }).toEqual({
			savedInRoot: { lines: renderedLines, exitCode: 0, finishedAt: expect.any(String) },
			savedInChild: undefined,
		});
	});

	test('a report that cannot be saved is one stderr line and never changes the exit code', async () => {
		const { config, cwd, result, flags, errors, exitCodes } = setupFinish({ withFolder: false });

		await expect(finishImplementRun({ config, cwd, result, flags })).rejects.toThrow(/process\.exit/);

		expect({ errors, exitCodes }).toEqual({ errors: [expect.stringContaining('run-finish-1')], exitCodes: [0] });
	});
});
