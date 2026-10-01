import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, jest, test } from '@jest/globals';
import { renderResult } from '#src/cli/internal/common/render/renderResult.ts';
import { FrictionArea } from '#src/contracts/friction/FrictionArea.ts';
import type { FrictionRecord } from '#src/contracts/friction/FrictionRecord.ts';
import { CleanupEndReason } from '#src/contracts/run/CleanupEndReason.ts';
import { PackagesSource } from '#src/contracts/run/PackagesSource.ts';
import type { RunCommit } from '#src/contracts/run/RunCommit.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { StandardsFinding } from '#src/contracts/standardsCheck/StandardsFinding.ts';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import { runDirFor } from '#tests/helpers/runDirFor.ts';

// renderResult summarizes a run from the evidence the run left on disk, so the
// arrangement is a real run directory in a temp repo — the summary is driven
// through the same reader the CLI uses, never stubbed. isTTY is pinned off so
// the ANSI paint helpers stay no-ops and the assertions read the plain text a
// piped consumer sees. The console is captured so a case can prove the
// renderer prints nothing itself.
const setupResult = ({
	manifest = {},
	ok = true,
	error,
	commands = [],
	friction = [],
	rejectedReports = 0,
}: {
	manifest?: Partial<RunManifest>;
	ok?: boolean;
	error?: string;
	commands?: { durationMs?: number; rerun?: true; skipped?: true }[];
	friction?: FrictionRecord[];
	rejectedReports?: number;
} = {}) => {
	const logged: string[] = [];
	const errors: string[] = [];

	process.stdout.isTTY = false;

	jest.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
		logged.push(String(args[0]));
	});

	jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
		errors.push(String(args[0]));
	});

	const fullManifest: RunManifest = {
		runId: 'run-1234-abcd',
		createdAt: '2026-01-01T00:00:00.000Z',
		updatedAt: '2026-01-01T00:00:03.000Z',
		plan: '.notes/plans/feature.md',
		harness: 'claude-code',
		status: RunStatus.Passed,
		currentStep: null,
		steps: [{ id: 'implement', status: RunStatus.Passed, attempts: 1 }],
		changedFiles: [],
		commits: [],
		packages: [],
		baselineDirtyFiles: [],
		testSubjects: [],
		acceptanceTests: [],
		approvedTests: [],
		unreachableChangedFiles: [],
		coverageExcludedChangedFiles: [],
		...manifest,
	};

	const cwd = mkdtempSync(join(tmpdir(), 'lightsout-print-result-'));
	const runDir = runDirFor({ cwd, runId: fullManifest.runId });

	mkdirSync(runDir, { recursive: true });

	if (commands.length > 0) {
		writeFileSync(join(runDir, 'commands.jsonl'), `${commands.map((command) => JSON.stringify(command)).join('\n')}\n`);
	}

	if (friction.length > 0) {
		writeFileSync(join(cwd, '.lightsout', 'friction.jsonl'), `${friction.map((entry) => JSON.stringify(entry)).join('\n')}\n`);
	}

	if (rejectedReports > 0) {
		mkdirSync(join(runDir, 'agents'));
		writeFileSync(join(runDir, 'agents', 'implement-1.json'), '{}');

		for (let index = 0; index < rejectedReports; index += 1) {
			writeFileSync(join(runDir, 'agents', `rejected-implement-${index}.json`), '{}');
		}
	}

	return { result: { ok, manifest: fullManifest, error }, cwd, logged, errors };
};

/** The labelled summary lines, with the step table's box-drawn rows and the blank spacers dropped. */
const labelLines = ({ lines }: { lines: string[] }) => lines.filter((line) => line !== '' && !/^[┌├└│]/.test(line));

test('renderResult: a clean run with no usage, scope, or gate history prints only the always-present lines', async () => {
	const { result, cwd } = setupResult();

	const lines = await renderResult({ result, cwd });

	expect(labelLines({ lines })).toStrictEqual([
		'run       run-1234 · PASSED',
		'plan      feature.md',
		'wall      3s',
		'gates     0s',
		'gates     0 commands',
		'evidence  .lightsout/runs/run-1234-abcd/',
	]);
});

test('renderResult: a failed run reports active time, usage, gate detail, retries, this run’s friction, and scope', async () => {
	const { result, cwd } = setupResult({
		ok: false,
		error: 'gate check failed: pnpm check',
		manifest: {
			status: RunStatus.Failed,
			updatedAt: '2026-01-01T00:02:05.000Z',
			steps: [
				{ id: 'implement', status: RunStatus.Passed, attempts: 1, durationMs: 65000, changedFiles: ['src/a.ts'] },
				{ id: 'write-tests', status: RunStatus.Failed, attempts: 2, durationMs: 5000 },
			],
			usage: { invocations: 3, inputTokens: 1000, outputTokens: 2500, cacheReadTokens: 7000, cacheCreationTokens: 2000, costUsd: 1.234 },
			packages: ['api', 'web'],
			packagesSource: PackagesSource.FrontMatter,
		},
		commands: [{ durationMs: 1000 }, { durationMs: 2000, rerun: true }, { skipped: true }],
		friction: [
			{ at: '2026-01-01T00:00:01.000Z', runId: 'run-1234-abcd', step: 'implement', area: FrictionArea.Plan, detail: 'ambiguous scope' },
			{ at: '2026-01-01T00:00:02.000Z', runId: 'run-1234-abcd', step: 'write-tests', area: FrictionArea.Plan, detail: 'no fixture named' },
			{ at: '2026-01-01T00:00:03.000Z', runId: 'run-1234-abcd', step: 'write-tests', area: FrictionArea.Prompt, detail: 'role unclear' },
			{ at: '2026-01-01T00:00:04.000Z', runId: 'another-run', step: 'implement', area: FrictionArea.Environment, detail: 'belongs to a different run' },
		],
		rejectedReports: 1,
	});

	const lines = await renderResult({ result, cwd });

	expect(labelLines({ lines })).toStrictEqual([
		'run       run-1234 · FAILED',
		'plan      feature.md',
		'wall      2m 05s',
		'active    1m 10s',
		'gates     3s',
		'tokens    in 1.0k · out 2.5k · cache-read 7.0k (70%)',
		'cost      $1.23 API-equivalent · 3 invocations',
		'gates     2 commands · 1 flake re-run · 1 skipped (no script)',
		'retries   1 rejected report re-emitted',
		'friction  3 · plan 2 · prompt 1',
		'scope     api · web (front-matter)',
		'evidence  .lightsout/runs/run-1234-abcd/',
	]);
});

test('renderResult: an invocation that reported no tokens prints usage with no cache share, and the count reads singular', async () => {
	const { result, cwd } = setupResult({
		manifest: { usage: { invocations: 1, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, costUsd: 0 } },
	});

	const lines = await renderResult({ result, cwd });

	expect(labelLines({ lines })).toStrictEqual([
		'run       run-1234 · PASSED',
		'plan      feature.md',
		'wall      3s',
		'gates     0s',
		'tokens    in 0 · out 0 · cache-read 0',
		'cost      $0.00 API-equivalent · 1 invocation',
		'gates     0 commands',
		'evidence  .lightsout/runs/run-1234-abcd/',
	]);
});

test('renderResult: a scope with no recorded source prints bare', async () => {
	const { result, cwd } = setupResult({ ok: false, manifest: { status: RunStatus.Failed, packages: ['api'] } });

	const lines = await renderResult({ result, cwd });

	expect(labelLines({ lines })).toStrictEqual([
		'run       run-1234 · FAILED',
		'plan      feature.md',
		'wall      3s',
		'gates     0s',
		'gates     0 commands',
		'scope     api',
		'evidence  .lightsout/runs/run-1234-abcd/',
	]);
});

test("renderResult: returns the report card as lines, prints nothing, and leaves the run's error out", async () => {
	const { result, cwd, logged, errors } = setupResult({
		ok: false,
		error: 'gate check failed: pnpm check',
		manifest: {
			status: RunStatus.Failed,
			steps: [
				{ id: 'implement', status: RunStatus.Passed, attempts: 1 },
				{ id: 'write-tests', status: RunStatus.Failed, attempts: 2 },
			],
		},
	});

	const lines = await renderResult({ result, cwd });
	const table = lines.filter((line) => /^[┌├└│]/.test(line));

	expect(lines[0]).toBe('');
	expect(labelLines({ lines })).toStrictEqual([
		'run       run-1234 · FAILED',
		'plan      feature.md',
		'wall      3s',
		'gates     0s',
		'gates     0 commands',
		'evidence  .lightsout/runs/run-1234-abcd/',
	]);
	// the step table sits inside the card: ruled top and bottom, one row per step and the total
	expect(table[0]).toMatch(/^┌/);
	expect(table.at(-1)).toMatch(/^└/);
	expect(table.filter((line) => /implement|write-tests|total/.test(line))).toHaveLength(3);
	// the renderer prints nothing itself, and the error is the caller's to print and save
	expect(logged).toStrictEqual([]);
	expect(errors).toStrictEqual([]);
	expect(lines.filter((line) => line.includes('gate check failed'))).toStrictEqual([]);
});

test('renderResult: files that finished the run unreachable surface as a named warning line', async () => {
	const { result, cwd } = setupResult({ manifest: { unreachableChangedFiles: ['src/orphan.ts', 'src/other.ts'] } });

	const lines = await renderResult({ result, cwd });

	expect(labelLines({ lines })).toStrictEqual([
		'run       run-1234 · PASSED',
		'plan      feature.md',
		'wall      3s',
		'gates     0s',
		'gates     0 commands',
		'warning   unreachable-changed-files: src/orphan.ts, src/other.ts — changed, but no public surface reaches them; no tests cover them',
		'evidence  .lightsout/runs/run-1234-abcd/',
	]);
});

/** One deterministic standards finding. Only the site key varies: the cleanup line counts findings, it never reads them. */
const finding = ({ siteKey }: { siteKey: string }): StandardsFinding => ({
	rule: 'file-size',
	severity: StandardsSeverity.Blocking,
	siteKey,
	files: [{ path: `src/${siteKey}.ts` }],
	detail: '412 lines, cap 400',
	measure: 412,
});

test('renderResult: a run that spent cleanup rounds prints one cleanup line naming the rounds, the reason, what remains and what failed', async () => {
	const { result, cwd } = setupResult({
		manifest: {
			steps: [
				{ id: 'implement', status: RunStatus.Passed, attempts: 1 },
				{
					id: 'refactor',
					status: RunStatus.Passed,
					attempts: 3,
					report: {
						roundsUsed: 2,
						endReason: CleanupEndReason.BudgetExhausted,
						remaining: [finding({ siteKey: 'a' }), finding({ siteKey: 'b' }), finding({ siteKey: 'c' })],
						inherited: [finding({ siteKey: 'd' }), finding({ siteKey: 'e' })],
						uncertain: [finding({ siteKey: 'f' }), finding({ siteKey: 'g' })],
						failures: ['cleanup agent timed out after 20 minutes'],
						initialReview: [],
						finalReview: [finding({ siteKey: 'h' })],
					},
				},
			],
		},
	});

	const lines = await renderResult({ result, cwd });
	const labels = labelLines({ lines });
	const cleanupLines = labels.filter((line) => line.startsWith('cleanup'));

	expect(cleanupLines).toHaveLength(1);
	// The wording is the printer's own; the four facts the line has to carry are
	// pinned, and each count is tied to the word it belongs to so a transposed
	// pair cannot pass.
	expect(cleanupLines[0]).toMatch(/\b2 rounds?\b/);
	expect(cleanupLines[0]).toContain('budget-exhausted');
	expect(cleanupLines[0]).toMatch(/\b3\b[^0-9]*(remain|standing)/);
	expect(cleanupLines[0]).toMatch(/\b1\b[^0-9]*fail/);
	expect(labels).toContain('gates     0 commands');
	expect(labels).toContain('evidence  .lightsout/runs/run-1234-abcd/');
});

test('renderResult: a run with no cleanup record prints no cleanup line', async () => {
	const { result, cwd } = setupResult({
		manifest: {
			steps: [
				{ id: 'implement', status: RunStatus.Passed, attempts: 1 },
				{ id: 'refactor', status: RunStatus.Passed, attempts: 1 },
			],
		},
	});

	const lines = await renderResult({ result, cwd });

	expect(labelLines({ lines })).toStrictEqual([
		'run       run-1234 · PASSED',
		'plan      feature.md',
		'wall      3s',
		'gates     0s',
		'gates     0 commands',
		'evidence  .lightsout/runs/run-1234-abcd/',
	]);
});

/** The commit lines of the result block — what the run says it left behind. */
const commitLines = ({ lines }: { lines: string[] }) => labelLines({ lines }).filter((line) => line.startsWith('commit'));

/** One commit a run recorded, addressed the way a plan run addresses its unit of work. */
const runCommit = ({ sha, subject }: { sha: string; subject: string }): RunCommit => ({ sha, subject, runId: 'run-1234-abcd' });

test('names every commit the run left behind', async () => {
	const { result, cwd } = setupResult({
		manifest: {
			changedFiles: ['src/a.ts'],
			commits: [
				runCommit({ sha: 'c0ffee1234567890c0ffee1234567890c0ffee12', subject: 'LO-150 001-planning-observability: Planning observability' }),
				runCommit({
					sha: 'decade9876543210decade9876543210decade98',
					subject: 'LO-150 001-planning-observability/phase2-activity-record: Planning observability',
				}),
			],
		},
	});

	const lines = await renderResult({ result, cwd });
	const commits = commitLines({ lines });

	expect(commits).toHaveLength(1);
	// both commits are named, each by its own sha and its own subject
	expect(commits[0]).toContain('c0ffee1');
	expect(commits[0]).toContain('LO-150 001-planning-observability: Planning observability');
	expect(commits[0]).toContain('decade9');
	expect(commits[0]).toContain('LO-150 001-planning-observability/phase2-activity-record: Planning observability');
	// the sha is abbreviated, never spelled out in full
	expect(commits[0]).not.toContain('c0ffee1234567890c0ffee1234567890c0ffee12');
	expect(commits[0]).not.toContain('decade9876543210decade9876543210decade98');
});

test('says the work was already in history when the run added no commit', async () => {
	const { result, cwd } = setupResult({ manifest: { changedFiles: ['src/a.ts'], commits: [] } });

	const lines = await renderResult({ result, cwd });
	const commits = commitLines({ lines });

	// the wording is the printer's own; what the line has to carry is that the
	// work is already committed, so nobody reaches for git status to find out
	expect(commits).toHaveLength(1);
	expect(commits[0]).toMatch(/already/i);
	expect(commits[0]).toMatch(/histor/i);
});

test('prints no commit line for a run that left nothing', async () => {
	const { result, cwd } = setupResult({ ok: false, manifest: { status: RunStatus.Failed, changedFiles: [], commits: [] } });

	const lines = await renderResult({ result, cwd });

	expect(commitLines({ lines })).toStrictEqual([]);
});
