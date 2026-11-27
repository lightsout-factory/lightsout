import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@jest/globals';
import { renderResult } from '#src/cli/common/implementRun/finishImplementRun/renderResult/renderResult.ts';
import { CleanupEndReason } from '#src/contracts/run/CleanupEndReason.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { StandardsFinding } from '#src/contracts/standardsCheck/StandardsFinding.ts';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import { resultLabelLines } from '#tests/helpers/resultLabelLines.ts';
import { seedRunFolder } from '#tests/helpers/seedRunFolder.ts';
import { singlePlanManifestOf } from '#tests/helpers/singlePlanManifestOf.ts';

// The cleanup lines of the result card, driven through a real run folder in a
// temp repo the way the CLI reads it. isTTY is pinned off so the ANSI paint
// helpers stay no-ops and the assertions read the plain text a piped consumer
// sees.
const setupCleanupResult = ({ steps }: { steps: RunManifest['steps'] }) => {
	process.stdout.isTTY = false;

	const manifest = singlePlanManifestOf({
		runId: 'run-1234-abcd',
		plan: '.notes/plans/feature.md',
		status: RunStatus.Passed,
		steps: [{ id: 'implement', status: RunStatus.Passed, attempts: 1 }, ...steps],
	});
	const cwd = mkdtempSync(join(tmpdir(), 'lightsout-print-result-'));

	seedRunFolder({ cwd, runId: manifest.runId });

	return { result: { ok: true, manifest, error: undefined }, cwd };
};

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
	const { result, cwd } = setupCleanupResult({
		steps: [
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
	});

	const lines = await renderResult({ result, cwd });
	const labels = resultLabelLines({ lines });
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
	const { result, cwd } = setupCleanupResult({ steps: [{ id: 'refactor', status: RunStatus.Passed, attempts: 1 }] });

	const lines = await renderResult({ result, cwd });

	expect(resultLabelLines({ lines })).toStrictEqual([
		'run       run-1234 · PASSED',
		'plan      feature.md',
		'wall      3s',
		'gates     0s',
		'gates     0 commands',
		'evidence  .lightsout/runs/run-1234-abcd/',
	]);
});

test('renderResult: adds the cleanup detail beneath the cleanup line', async () => {
	const handed = [finding({ siteKey: 'a' }), finding({ siteKey: 'b' })].map((entry) => ({ ...entry, rule: 'acme/max-nesting' }));
	const report = { roundsUsed: 1, endReason: CleanupEndReason.BudgetExhausted, remaining: handed.slice(1), targeted: handed };
	const refactor = {
		id: 'refactor',
		status: RunStatus.Passed,
		attempts: 1,
		report: { ...report, inherited: [], uncertain: [], failures: [], initialReview: [], finalReview: [] },
	};
	const { result, cwd } = setupCleanupResult({ steps: [refactor] });

	const lines = await renderResult({ result, cwd });
	const labels = resultLabelLines({ lines });
	const cleanupAt = labels.findIndex((line) => line.startsWith('cleanup'));

	// the detail sits under the label column right after the cleanup line: found and fixed, then the finding still standing with its rule and file
	expect(labels.slice(cleanupAt + 1)).toStrictEqual([
		expect.stringMatching(/^ {10}found 2\b.*fixed 1\b/),
		expect.stringMatching(/^ {10}remaining acme\/max-nesting\b.*src\/b\.ts/),
		'evidence  .lightsout/runs/run-1234-abcd/',
	]);
	expect(labels.filter((line) => /merge/i.test(line))).toStrictEqual([]);
});
