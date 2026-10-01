import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { readRunOwner } from '#src/runState/owner/readRunOwner.ts';
import { seedRunFolder } from '#tests/helpers/seedRunFolder.ts';

/** An empty checkout holding the named runs, each with a hand-written owner.json beside the runs that have none. */
const setupCheckout = ({ files = {}, runIds = [] }: { files?: Record<string, string>; runIds?: string[] } = {}) => {
	const cwd = mkdtempSync(join(tmpdir(), 'lightsout-run-owner-'));

	// An owner record lives in the run's own folder, which is looked up by id —
	// so every run has to be findable whether or not it holds a record.
	for (const runId of runIds) {
		seedRunFolder({ cwd, runId });
	}

	for (const [runId, contents] of Object.entries(files)) {
		writeFileSync(join(seedRunFolder({ cwd, runId }), 'owner.json'), contents);
	}

	return { cwd };
};

describe('readRunOwner', () => {
	test('reads an absent or unparseable owner record as undefined', async () => {
		const { cwd } = setupCheckout({
			runIds: ['run-no-owner'],
			files: {
				'run-garbled': '{ this is not json',
				'run-off-contract': JSON.stringify({ recordedAt: '2026-09-30T09:00:00.000Z' }),
			},
		});

		const owners = await Promise.all([
			readRunOwner({ cwd, runId: 'run-no-owner' }),
			readRunOwner({ cwd, runId: 'run-garbled' }),
			readRunOwner({ cwd, runId: 'run-off-contract' }),
		]);

		expect(owners).toEqual([undefined, undefined, undefined]);
	});
});
