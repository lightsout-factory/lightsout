import { execSync } from 'node:child_process';
import { readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { expect, test } from '@jest/globals';
import { readConfig } from '#src/common/config/readConfig.ts';
import { RefactorStepReport } from '#src/contracts/run/RefactorStepReport.ts';
import { runImplementPipeline } from '#src/pipeline/runImplementPipeline/runImplementPipeline.ts';
import { attributionDriver } from '#tests/helpers/attributionDriver.ts';
import { linkTypescript } from '#tests/helpers/linkTypescript.ts';
import { runDirFor } from '#tests/helpers/runDirFor.ts';
import { setupConsumerRepo } from '#tests/helpers/setupConsumerRepo.ts';
import { writeSource } from '#tests/helpers/writeSource.ts';

// The standards gate's attribution: the pre-edit baseline decides which
// findings are this run's own work, which it inherited, and which it cannot place.

/**
 * A source file already over the line cap: a note line, padding, and one
 * export. The note is what lets two files of the same length differ in content,
 * so a rewrite that adds no line is still a real edit.
 */
const overCapSource = ({ name, note, pad }: { name: string; note: string; pad: number }) =>
	`// ${note}\n${'// pad\n'.repeat(pad)}export const ${name} = () => 1;\n`;

test('a ledgered site the run measurably worsened still qualifies, and an unchanged one does not', async () => {
	// Two files already past the cap before the run starts, both accepted in the
	// committed debt ledger at the repo root. The run grows one and rewrites the
	// other at exactly the same length.
	const dir = setupConsumerRepo({
		config: { 'standards-rule-settings': { 'file-size': { severity: 'blocking', options: { file: 6 } } } },
		sources: {
			'src/index.js': 'export const one = 1;\n',
			'src/grown.js': overCapSource({ name: 'grown', note: 'first', pad: 7 }),
			'src/steady.js': overCapSource({ name: 'steady', note: 'first', pad: 7 }),
		},
	});
	writeFileSync(
		join(dir, 'lightsout.standards-baseline.json'),
		JSON.stringify({ at: '2026-01-01T00:00:00.000Z', path: '.', siteKeys: ['lightsout/file-size:src/grown.js', 'lightsout/file-size:src/steady.js'] }),
	);
	execSync('git add -A && git -c user.name=t -c user.email=t@t commit -qm ledger', { cwd: dir });
	// the line-count rule reads a parsed tree, so the repo needs a compiler
	linkTypescript({ dir });

	const refactorPrompts: string[] = [];
	const driver = attributionDriver({
		dir,
		testFile: 'test/grown.test.js',
		refactorPrompts,
		implement: () => {
			writeSource({ dir, path: 'src/grown.js', source: overCapSource({ name: 'grown', note: 'first', pad: 29 }) });
			writeSource({ dir, path: 'src/steady.js', source: overCapSource({ name: 'steady', note: 'second', pad: 7 }) });

			return ['src/grown.js', 'src/steady.js'];
		},
	});

	const result = await runImplementPipeline({
		cwd: dir,
		driver,
		config: await readConfig({ cwd: dir }),
		loadedConfig: { config: await readConfig({ cwd: dir }) },
		planPath: 'plan.md',
	});

	const cleanup = RefactorStepReport.parse(result.manifest.steps.find((step) => step.id === 'refactor')?.report);
	const remaining = cleanup.remaining.map((finding) => finding.siteKey);

	// the ledger accepted this site and the run made it bigger — the live check
	// has to read past the ledger, or accepted debt could grow unwatched
	expect(refactorPrompts[0] ?? '').toContain('[lightsout/file-size] src/grown.js');
	expect(remaining).toContain('lightsout/file-size:src/grown.js');
	// the same rule on a file the run rewrote at the same length is debt it
	// inherited: recorded, never handed back as work
	expect(refactorPrompts[0] ?? '').not.toContain('[lightsout/file-size] src/steady.js');
	expect(cleanup.inherited.map((finding) => finding.siteKey)).toContain('lightsout/file-size:src/steady.js');
	expect(remaining).not.toContain('lightsout/file-size:src/steady.js');
	expect(result.ok).toBe(true);
});

test('a folder finding already in the baseline never gates a change inside the folder', async () => {
	// A folder already past the crowding cap before the run starts. The run
	// edits one file inside it and creates none, so the folder measures exactly
	// what the baseline recorded — the case that used to stop an unattended run.
	const dir = setupConsumerRepo({
		config: { 'standards-rule-settings': { 'folder-size': { severity: 'blocking', options: { cap: 3 } } } },
		sources: {
			'src/index.js': 'export const one = 1;\n',
			'src/pile/alpha.js': 'export const alpha = () => 1;\n',
			'src/pile/beta.js': 'export const beta = () => 2;\n',
		},
	});
	const refactorPrompts: string[] = [];
	const driver = attributionDriver({
		dir,
		testFile: 'test/alpha.test.js',
		refactorPrompts,
		implement: () => {
			// its consumer is already there, so the folder gains no file
			writeSource({ dir, path: 'src/pile/alpha.js', source: 'export const alpha = () => 11;\n' });

			return ['src/pile/alpha.js'];
		},
	});

	const result = await runImplementPipeline({
		cwd: dir,
		driver,
		config: await readConfig({ cwd: dir }),
		loadedConfig: { config: await readConfig({ cwd: dir }) },
		planPath: 'plan.md',
	});

	const cleanup = RefactorStepReport.parse(result.manifest.steps.find((step) => step.id === 'refactor')?.report);

	// the folder is in scope because a file under it changed — and that is
	// exactly why it must not be work: the run did not crowd it
	expect(cleanup.inherited.map((finding) => finding.siteKey)).toContain('lightsout/folder-size:src/pile');
	expect(cleanup.remaining).toStrictEqual([]);
	expect(refactorPrompts.every((prompt) => !prompt.includes('[lightsout/folder-size]'))).toBe(true);
	expect(result.ok).toBe(true);
	expect(result.manifest.steps.find((step) => step.id === 'refactor')?.status).toBe('passed');
});

test('a run with no baseline records every finding as uncertain', async () => {
	const dir = setupConsumerRepo();
	const refactorPrompts: string[] = [];
	let reviews = 0;
	const driver = attributionDriver({
		dir,
		testFile: 'test/messy.test.js',
		refactorPrompts,
		onReview: () => {
			reviews += 1;
		},
		implement: () => {
			writeSource({ dir, path: 'src/messy.js', source: 'export const first = () => 1;\nexport const second = () => 2;\n' });

			// what a run created before the baseline existed looks like once it is
			// resumed past clean-slate: the comparison point is simply not there
			const runsDir = dirname(runDirFor({ cwd: dir, runId: 'any' }));

			for (const id of readdirSync(runsDir)) {
				rmSync(join(runsDir, id, 'standards-baseline.json'), { force: true });
			}

			return ['src/messy.js'];
		},
	});

	const result = await runImplementPipeline({
		cwd: dir,
		driver,
		config: await readConfig({ cwd: dir }),
		loadedConfig: { config: await readConfig({ cwd: dir }) },
		planPath: 'plan.md',
	});

	const cleanup = RefactorStepReport.parse(result.manifest.steps.find((step) => step.id === 'refactor')?.report);

	// no comparison point means no claim about where a finding came from
	expect(cleanup.uncertain.map((finding) => finding.siteKey)).toContain('lightsout/multi-export:src/messy.js');
	expect(cleanup.remaining).toStrictEqual([]);
	// nothing qualified, so no cleanup agent was ever spent
	expect(refactorPrompts).toStrictEqual([]);
	expect(cleanup.roundsUsed).toBe(0);
	expect(cleanup.endReason).toBe('no-work');
	// provenance is what is missing, not the judgment reviewer's read
	expect(reviews).toBe(1);
	expect(result.ok).toBe(true);
});
