/**
 * @jest-environment node
 */
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from '@jest/globals';
import { getPlanEvidenceServerFn } from '#src/features/workOrders/server/getPlanEvidenceServerFn.ts';

/** A repo holding one drafted single plan, named to the server function through LIGHTSOUT_REPO — the only seam a test has on the repo root. */
const setupPlanRepo = async () => {
	const repoRoot = await mkdtemp(join(tmpdir(), 'lightsout-plan-evidence-server-fn-'));
	const workspace = join(repoRoot, '.lightsout', 'work-orders', 'search-ranking', 'plans', '001-ranking');

	await mkdir(workspace, { recursive: true });
	await writeFile(join(workspace, 'plan.md'), '# Search ranking\n', 'utf8');
	process.env.LIGHTSOUT_REPO = repoRoot;

	return { heldName: 'search-ranking/001-ranking', missingName: 'search-ranking/002-never-planned' };
};

afterEach(() => {
	delete process.env.LIGHTSOUT_REPO;
});

describe('getPlanEvidenceServerFn', () => {
	test('answers the plan evidence for its address and not-found for a plan no folder answers to', async () => {
		const { heldName, missingName } = await setupPlanRepo();

		const [held, missing] = await Promise.allSettled([
			getPlanEvidenceServerFn({ data: { name: heldName } }),
			getPlanEvidenceServerFn({ data: { name: missingName } }),
		]);

		expect({
			held: held.status === 'fulfilled' ? { name: held.value.name, buildRunId: held.value.buildRunId } : held.reason,
			missing: missing.status === 'rejected' ? missing.reason : missing.value,
		}).toStrictEqual({
			held: { name: 'search-ranking/001-ranking', buildRunId: undefined },
			missing: { isNotFound: true },
		});
	});
});
