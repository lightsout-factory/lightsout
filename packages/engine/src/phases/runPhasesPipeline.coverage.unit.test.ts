import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, jest, test } from '@jest/globals';
import { readConfig } from '#src/common/config/readConfig.ts';
import { runPhasesPipeline } from '#src/phases/runPhasesPipeline.ts';
import { readRunLock } from '#src/runState/lock/readRunLock.ts';
import { readRunManifest } from '#src/runState/readRunManifest.ts';
import { createPhaseDriver } from '#tests/helpers/createPhaseDriver.ts';
import { readPhaseChildRuns } from '#tests/helpers/readPhaseChildRuns.ts';
import { setupPhasedRepo } from '#tests/helpers/setupPhasedRepo.ts';

// Mocked Imports
// -------------------------
// Git and every phase stay real: only the coordinator's discard of the carried
// build output is doubled, because a refusal there cannot be arranged in a real
// repository without also breaking the phase commits that precede it.
interface DiscardParams {
	cwd: string;
	paths: string[];
}

const actual = jest.requireActual<typeof import('#src/commit/discardGeneratedChanges.ts')>('#src/commit/discardGeneratedChanges.ts');
const mockDiscardGeneratedChanges = jest.fn<(params: DiscardParams) => Promise<string | undefined>>();

jest.mock('#src/commit/discardGeneratedChanges.ts', () => ({
	discardGeneratedChanges: (params: DiscardParams) => mockDiscardGeneratedChanges(params),
}));
// -------------------------
// Answers for itself only when it returns a promise; otherwise git is read for
// real, so every phase sees its own tree.
const actualGit = jest.requireActual<typeof import('#src/common/git/readGitChangedFiles.ts')>('#src/common/git/readGitChangedFiles.ts');
const mockReadGitChangedFiles = jest.fn<(params: { cwd: string }) => Promise<string[] | undefined> | undefined>();

jest.mock('#src/common/git/readGitChangedFiles.ts', () => ({
	readGitChangedFiles: (params: { cwd: string }) => mockReadGitChangedFiles(params) ?? actualGit.readGitChangedFiles(params),
}));
// -------------------------

/** Rebuilds `dist/` from the listing of `src/`, so every phase that adds a source file changes the build output. */
const buildCommand = 'mkdir -p dist && ls src > dist/listing.txt';

const refusal = 'fatal: Unable to create dist/.lock: File exists.';

/**
 * A committable two-phase repo whose config lists `dist/` under `generated` and
 * whose `build` gate rewrites it, with `dist/` committed matching the initial
 * source — so each phase leaves carried build output for the coordinator to discard.
 */
const setupCarriedOutputRepo = async () => {
	const { dir, overviewPath } = setupPhasedRepo({ phases: 2 });
	const configPath = join(dir, 'lightsout.config.json');
	const raw: { gates: Record<string, unknown> } = JSON.parse(readFileSync(configPath, 'utf8'));

	writeFileSync(configPath, JSON.stringify({ ...raw, gates: { ...raw.gates, build: buildCommand }, generated: ['dist/'] }));
	writeFileSync(join(dir, '.gitignore'), '.lightsout/\n');
	execSync(`${buildCommand} && git config user.name t && git config user.email t@t && git add -A && git commit -qm ignore`, { cwd: dir, stdio: 'ignore' });

	const config = await readConfig({ cwd: dir });

	return { dir, overviewPath, config };
};

/** A sequence whose phases all pass while the coordinator's discard of their carried output is refused. */
const setupRefusedDiscard = async () => {
	mockDiscardGeneratedChanges.mockResolvedValue(refusal);

	return setupCarriedOutputRepo();
};

/** That same sequence already ended failed on the refused discard, with the discard now answering as git would. */
const setupFailedDiscardSequence = async () => {
	const { dir, overviewPath, config } = await setupRefusedDiscard();
	const failed = await runPhasesPipeline({ cwd: dir, driver: createPhaseDriver({ dir, seen: [] }), config, overviewPath, skipRefactor: true });
	const failedChildren = await readPhaseChildRuns({ cwd: dir, manifest: failed.manifest });

	mockDiscardGeneratedChanges.mockImplementation(actual.discardGeneratedChanges);

	return { dir, config, failed, failedChildRunIds: failedChildren.map((child) => child.runId) };
};

/**
 * A sequence whose phases all pass, but whose tree git cannot read once the
 * coordinator holds the repo lock for the discard — told apart from every
 * phase's own read by the coordinator's pre-minted id on the lock.
 */
const setupUnreadableTreeAfterPhases = async () => {
	const repo = await setupCarriedOutputRepo();
	const runId = 'sequence-with-unreadable-tree';

	mockDiscardGeneratedChanges.mockImplementation(actual.discardGeneratedChanges);
	mockReadGitChangedFiles.mockImplementation(async ({ cwd }) => {
		const holder = await readRunLock({ cwd });

		return holder?.runId === runId ? undefined : actualGit.readGitChangedFiles({ cwd });
	});

	return { ...repo, runId };
};

describe('runPhasesPipeline', () => {
	test('ends the sequence failed and resumable when the carried build output cannot be discarded', async () => {
		const { dir, overviewPath, config } = await setupRefusedDiscard();

		const result = await runPhasesPipeline({ cwd: dir, driver: createPhaseDriver({ dir, seen: [] }), config, overviewPath, skipRefactor: true });
		const persisted = await readRunManifest({ cwd: dir, runId: result.manifest.runId });

		// the coordinator was handed the build output the phases carried, and nothing else
		expect(mockDiscardGeneratedChanges).toHaveBeenCalledWith({ cwd: dir, paths: ['dist/listing.txt'] });
		// failed rather than passed, with no phase blamed: every phase step still passed
		expect({
			ok: result.ok,
			status: persisted.status,
			currentStep: persisted.currentStep,
			stepStatuses: persisted.steps.map((step) => step.status),
		}).toStrictEqual({ ok: false, status: 'failed', currentStep: null, stepStatuses: ['passed', 'passed'] });
		// the refusal rides along, and so does the door the sequence comes back through
		expect(result.error ?? '').toContain(refusal);
		expect(result.error ?? '').toContain(`lightsout resume --run ${result.manifest.runId}`);
	});

	test('a resumed sequence whose only unfinished work is the carried-output discard passes without re-running a phase', async () => {
		const { dir, config, failed, failedChildRunIds } = await setupFailedDiscardSequence();
		const seen: number[] = [];

		const resumed = await runPhasesPipeline({ cwd: dir, driver: createPhaseDriver({ dir, seen }), config, existing: failed.manifest, skipRefactor: true });
		const resumedChildren = await readPhaseChildRuns({ cwd: dir, manifest: resumed.manifest });
		const status = execSync('git status --porcelain -uall', { cwd: dir, encoding: 'utf8' });

		// the error rides along so a failure says why, rather than only that it failed
		expect({ ok: resumed.ok, error: resumed.error, status: resumed.manifest.status }).toStrictEqual({ ok: true, error: undefined, status: 'passed' });
		// no phase was handed to an agent again, and each step still names the run that implemented it
		expect(seen).toStrictEqual([]);
		expect(resumedChildren.map((child) => child.runId)).toStrictEqual(failedChildRunIds);
		// the carried build output is gone, as a single-phase build leaves the tree
		expect(status).toBe('');
	});

	test('ends the sequence failed rather than passed when git cannot read the tree the carried output sits in', async () => {
		const { dir, overviewPath, config, runId } = await setupUnreadableTreeAfterPhases();

		const result = await runPhasesPipeline({ cwd: dir, driver: createPhaseDriver({ dir, seen: [] }), config, overviewPath, runId, skipRefactor: true });
		const persisted = await readRunManifest({ cwd: dir, runId });
		const status = execSync('git status --porcelain -uall', { cwd: dir, encoding: 'utf8' });

		// an unreadable tree is never read as "nothing changed": the sequence is not stamped passed
		expect({
			ok: result.ok,
			status: persisted.status,
			currentStep: persisted.currentStep,
			stepStatuses: persisted.steps.map((step) => step.status),
		}).toStrictEqual({ ok: false, status: 'failed', currentStep: null, stepStatuses: ['passed', 'passed'] });
		expect(result.error ?? '').toContain(dir);
		expect(result.error ?? '').toContain(`lightsout resume --run ${runId}`);
		// nothing was discarded, so the carried build output is still on disk for the resume
		expect(status).toBe(' M dist/listing.txt\n');
	});
});
