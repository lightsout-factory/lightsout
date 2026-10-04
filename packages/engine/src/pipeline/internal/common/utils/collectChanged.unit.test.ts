import { mkdirSync, mkdtempSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import type { WorkReport } from '#src/contracts/work/WorkReport.ts';
import { WorkReportStatus } from '#src/contracts/work/WorkReportStatus.ts';
import { collectChanged } from '#src/pipeline/internal/common/utils/collectChanged.ts';
import type { PipelineRun } from '#src/pipeline/internal/PipelineRun.ts';
import { commitAll } from '#tests/helpers/commitAll.ts';
import { runInRepo } from '#tests/helpers/runInRepo.ts';
import { setupConsumerRepo } from '#tests/helpers/setupConsumerRepo.ts';
import { writeRepoFile } from '#tests/helpers/writeRepoFile.ts';

/** The step every stub manifest names as current, so a warning line can be checked for it. */
const currentStep = 'implement';

/**
 * A PipelineRun stub over the repo at `cwd`, whose manifest carries `changedFiles`
 * from an earlier step and whose every narrated line is kept.
 */
const stubRun = ({ cwd, changedFiles }: { cwd: string; changedFiles: string[] }) => {
	const progressLines: string[] = [];
	const manifest = { runId: 'run-1', currentStep, changedFiles, packages: [], baselineDirtyFiles: [] } as unknown as RunManifest;
	const run = {
		cwd,
		config: { gates: { check: 'true', test: 'true' } } as unknown as LightsoutConfig,
		current: () => manifest,
		progress: (message: string) => {
			progressLines.push(message);
		},
	} as unknown as PipelineRun;

	return { run, progressLines };
};

/** One agent report listing `paths` as its changed files, in that order. */
const reportOf = ({ paths }: { paths: string[] }): WorkReport => ({
	status: WorkReportStatus.Complete,
	changedFiles: paths.map((path) => ({ path, summary: 'changed' })),
	summary: 'stub',
	failures: [],
});

/**
 * A real git repo at the step's start: `committed` files and `links` (path to
 * link target) are committed on top of the repo's own `src/index.js`; then each
 * of `moves` is applied with `git mv` and `write` left in the working tree. The
 * agent's report lists what `reported` answers, given the repo's cwd and an
 * existing file outside it.
 */
const setupCollectChanged = ({
	committed = {},
	links = {},
	moves = [],
	write = {},
	changedFiles = [],
	reported = () => [],
}: {
	committed?: Record<string, string>;
	links?: Record<string, string>;
	moves?: { from: string; to: string }[];
	write?: Record<string, string>;
	changedFiles?: string[];
	reported?: (paths: { cwd: string; outsideFile: string }) => string[];
} = {}) => {
	const cwd = setupConsumerRepo();

	for (const [path, content] of Object.entries(committed)) {
		writeRepoFile({ cwd, path, content });
	}

	for (const [path, target] of Object.entries(links)) {
		mkdirSync(dirname(join(cwd, path)), { recursive: true });
		symlinkSync(target, join(cwd, path));
	}

	if (Object.keys(committed).length > 0 || Object.keys(links).length > 0) {
		commitAll({ cwd, message: 'the step start' });
	}

	for (const { from, to } of moves) {
		runInRepo({ cwd, command: 'git', args: ['mv', from, to] });
	}

	for (const [path, content] of Object.entries(write)) {
		writeRepoFile({ cwd, path, content });
	}

	const outsideDir = mkdtempSync(join(tmpdir(), 'lightsout-outside-'));
	writeRepoFile({ cwd: outsideDir, path: 'outside.js', content: 'export const outside = 1;\n' });
	const reports = [reportOf({ paths: reported({ cwd, outsideFile: join(outsideDir, 'outside.js') }) })];
	const { run, progressLines } = stubRun({ cwd, changedFiles });

	return { run, reports, progressLines };
};

/** A repo git cannot read, holding only its own `src/index.js`, whose agent reported `reported`. */
const setupUnreadableRepo = ({ reported }: { reported: string[] }) => {
	const cwd = setupConsumerRepo({ git: false });
	const reports = [reportOf({ paths: reported })];
	const { run, progressLines } = stubRun({ cwd, changedFiles: [] });

	return { run, reports, progressLines };
};

describe('collectChanged', () => {
	test('keeps a reported regular file and a reported path git lists as removed', async () => {
		const { run, reports, progressLines } = setupCollectChanged({
			committed: { 'src/old.js': 'export const old = 1;\n' },
			moves: [{ from: 'src/old.js', to: 'src/new.js' }],
			write: { 'src/index.js': 'export const one = 2;\n' },
			reported: () => ['src/old.js', 'src/new.js', 'src/index.js'],
		});

		const result = await collectChanged({ run, reports });

		expect({ changedFiles: result.changedFiles, progressLines }).toStrictEqual({
			changedFiles: ['src/old.js', 'src/new.js', 'src/index.js'],
			progressLines: [],
		});
	});

	test('drops reported entries that are not files in the working tree and names them in one warning line', async () => {
		const { run, reports, progressLines } = setupCollectChanged({
			write: { 'src/real.js': 'export const real = 1;\n' },
			reported: () => ['src/real.js', 'updated the widget module', 'src', '../outside.js', 'src/ghost.js'],
		});

		const result = await collectChanged({ run, reports });

		expect({ changedFiles: result.changedFiles, progressLines }).toEqual({
			changedFiles: ['src/real.js'],
			progressLines: [
				expect.stringMatching(/^warning unreal-reported-paths: .*implement.*\b4\b.*"updated the widget module".*"src".*"\.\.\/outside\.js".*"src\/ghost\.js"/),
			],
		});
	});

	test("stores an absolute path inside the run's cwd and a dot-prefixed path in cwd-relative form", async () => {
		const { run, reports } = setupCollectChanged({
			write: { 'src/a.js': 'export const a = 1;\n', 'src/b.js': 'export const b = 1;\n' },
			reported: ({ cwd, outsideFile }) => [join(cwd, 'src/a.js'), './src/b.js', outsideFile],
		});

		const result = await collectChanged({ run, reports });

		expect(result.changedFiles).toStrictEqual(['src/a.js', 'src/b.js']);
	});

	test('keeps a reported symbolic link without following it', async () => {
		const { run, reports } = setupCollectChanged({
			links: { 'src/link.js': './does-not-exist.js' },
			reported: () => ['src/link.js'],
		});

		const result = await collectChanged({ run, reports });

		expect(result.changedFiles).toStrictEqual(['src/link.js']);
	});

	test('drops a carried-over manifest entry that is not a real path and keeps the real ones', async () => {
		const { run, reports, progressLines } = setupCollectChanged({
			write: { 'src/index.js': 'export const one = 2;\n' },
			changedFiles: ['src/index.js', 'not a path'],
		});

		const result = await collectChanged({ run, reports });

		expect({ changedFiles: result.changedFiles, progressLines }).toStrictEqual({
			changedFiles: ['src/index.js'],
			progressLines: [],
		});
	});

	test('judges reported paths on disk alone when git cannot read the tree', async () => {
		const { run, reports, progressLines } = setupUnreadableRepo({ reported: ['src/index.js', 'src/missing.js'] });

		const result = await collectChanged({ run, reports });

		expect({ changedFiles: result.changedFiles, progressLines }).toEqual({
			changedFiles: ['src/index.js'],
			progressLines: [expect.stringMatching(/^warning unreal-reported-paths: .*"src\/missing\.js"/)],
		});
	});
});
