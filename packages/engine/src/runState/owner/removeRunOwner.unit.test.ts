import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { readRunOwner } from '#src/runState/owner/readRunOwner.ts';
import { removeRunOwner } from '#src/runState/owner/removeRunOwner.ts';
import { seedRunFolder } from '#tests/helpers/seedRunFolder.ts';

/**
 * A checkout holding one run with an owner record and one run without. Every
 * case gets its own temporary checkout, because the run lookup remembers what
 * it found for the life of the process.
 */
const setupCheckout = () => {
	const cwd = mkdtempSync(join(tmpdir(), 'lightsout-run-owner-'));
	const ownedRunDir = seedRunFolder({ cwd, runId: 'run-owned' });
	const ownerPath = join(ownedRunDir, 'owner.json');

	seedRunFolder({ cwd, runId: 'run-no-owner' });
	writeFileSync(ownerPath, JSON.stringify({ pid: 4242, recordedAt: '2026-09-30T09:00:00.000Z' }), 'utf8');

	return { cwd, ownerPath };
};

describe('removeRunOwner', () => {
	test("removes a run's owner record and is quiet when there is nothing to remove", async () => {
		const { cwd, ownerPath } = setupCheckout();

		const removals = await Promise.all([
			removeRunOwner({ cwd, runId: 'run-owned' }),
			removeRunOwner({ cwd, runId: 'run-no-owner' }),
			removeRunOwner({ cwd, runId: 'no-run-answers-to-this-id' }),
		]);

		const owner = await readRunOwner({ cwd, runId: 'run-owned' });

		expect(removals).toEqual([undefined, undefined, undefined]);
		expect({ owner, recordOnDisk: existsSync(ownerPath) }).toStrictEqual({ owner: undefined, recordOnDisk: false });
	});
});
