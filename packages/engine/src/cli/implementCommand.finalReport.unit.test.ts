import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, jest, test } from '@jest/globals';
import { parseFlags } from '#src/cli/common/args/parseFlags.ts';
import { implementCommand } from '#src/cli/implementCommand.ts';
import type { Driver } from '#src/drivers/common/types/Driver.ts';
import { captureCommandOutput } from '#tests/helpers/captureCommandOutput.ts';
import { runDirFor } from '#tests/helpers/runDirFor.ts';
import { setupConsumerRepo } from '#tests/helpers/setupConsumerRepo.ts';

// Mocked Imports
// -------------------------
// The harness is the one unowned boundary: every spawn fails as a step failure,
// so the first agent a phase reaches ends that phase — and with it the sequence.
const mockStubDriver: Driver = {
	name: 'stub',
	invoke: async () => {
		throw new Error('the stub harness ends the phase');
	},
};

jest.mock('#src/drivers/getDriver.ts', () => ({ getDriver: () => mockStubDriver }));
// -------------------------

/** The plan folder the phased case points `--plan` at. */
const planFolder = 'plans/demo';

/** Every run these cases start belongs to no plan, so the implement command's own runs folder holds them all. */
const runsDirOf = ({ cwd }: { cwd: string }) => dirname(runDirFor({ cwd, runId: 'any' }));

/** Each run folder the command left, with its manifest and the report.json it holds, if any. */
const readRuns = ({ cwd }: { cwd: string }) =>
	readdirSync(runsDirOf({ cwd })).map((runId) => {
		const runDir = join(runsDirOf({ cwd }), runId);
		const manifest: { runId: string; pipeline?: string } = JSON.parse(readFileSync(join(runDir, 'manifest.json'), 'utf8'));
		const reportPath = join(runDir, 'report.json');
		const report: { lines: string[]; exitCode: number; finishedAt: string } | undefined = existsSync(reportPath)
			? JSON.parse(readFileSync(reportPath, 'utf8'))
			: undefined;

		return { manifest, report };
	});

/**
 * A real consumer repo the command runs in. With no `phases`, `--plan` names a
 * file that is not there: the pipeline mints the run, then fails at the plan
 * read. With `phases`, the folder holds that many phases, and the stub driver
 * ends the sequence at its first.
 */
const setupImplementRun = ({ phases }: { phases?: number } = {}) => {
	const captured = captureCommandOutput();
	const cwd = setupConsumerRepo({});

	if (phases !== undefined) {
		const rows = Array.from({ length: phases }, (_, index) => `| ${index + 1} | \`phase${index + 1}.md\` | scope |`);
		const overview = `# Feature — Overview\n\n## Phases\n\n| # | File | Scope |\n|---|------|-------|\n${rows.join('\n')}\n`;

		mkdirSync(join(cwd, planFolder), { recursive: true });
		writeFileSync(join(cwd, planFolder, 'overview.md'), overview);

		for (let phase = 1; phase <= phases; phase += 1) {
			writeFileSync(join(cwd, planFolder, `phase${phase}.md`), `# Feature — Phase ${phase}\n`);
		}
	}

	// `implement` refuses to start in a checkout holding uncommitted changes.
	execSync('git add -A && git -c user.name=t -c user.email=t@t commit -qm plans --allow-empty', { cwd, stdio: 'ignore' });

	const plan = phases === undefined ? 'ghost.md' : planFolder;

	return { context: { flags: parseFlags({ args: ['--plan', plan, '--no-worktree'] }), rest: [], cwd }, cwd, ...captured };
};

describe('implementCommand final report', () => {
	test('a failed run saves the report it printed, its error last, with the code it exits with', async () => {
		const { context, cwd, logged, errors, exitCodes } = setupImplementRun();

		await expect(implementCommand(context)).rejects.toThrow(/process\.exit/);

		const [run] = readRuns({ cwd });
		const savedLines = run?.report?.lines ?? [];
		const reportLines = savedLines.slice(0, -2);

		// the report card is the tail of stdout; the error went to stderr as one
		// write with a leading newline, and is saved as a blank entry and its text
		expect({
			exitCode: run?.report?.exitCode,
			printedReport: logged.slice(-reportLines.length),
			savedError: savedLines.slice(-2),
		}).toStrictEqual({
			exitCode: 1,
			printedReport: reportLines,
			savedError: ['', errors.at(-1)?.slice(1)],
		});
		expect(errors.at(-1)?.startsWith('\n')).toBe(true);
		expect(reportLines.length).toBeGreaterThan(0);
		expect(exitCodes).toStrictEqual([1]);
	});

	test("a phased run saves its report in the coordinator's folder and none in its phase's", async () => {
		const { context, cwd, exitCodes } = setupImplementRun({ phases: 2 });

		await expect(implementCommand(context)).rejects.toThrow(/process\.exit/);

		const runs = readRuns({ cwd });
		const savedIn = runs
			.map((run) => ({ coordinator: run.manifest.pipeline === 'phases', saved: run.report !== undefined, exitCode: run.report?.exitCode }))
			.sort((left, right) => Number(left.coordinator) - Number(right.coordinator));

		expect(savedIn).toStrictEqual([
			{ coordinator: false, saved: false, exitCode: undefined },
			{ coordinator: true, saved: true, exitCode: 1 },
		]);
		expect(exitCodes).toStrictEqual([1]);
	});
});
