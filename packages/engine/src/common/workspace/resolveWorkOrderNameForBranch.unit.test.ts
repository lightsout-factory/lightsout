import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { resolveWorkOrderNameForBranch } from '#src/common/workspace/resolveWorkOrderNameForBranch.ts';

/**
 * A state the contract accepts, written by hand so the look-up is the only
 * thing under test. `branch` is stated apart from `name`, because a work order
 * created from a prefixed `queue.branch-template` saves one its label does not
 * spell.
 */
const workOrderStateOf = ({ name, branch }: { name: string; branch: string }) => ({
	schemaVersion: 1,
	name,
	branch,
	mode: 'multiple-plan',
	plans: [],
	history: [],
});

/**
 * A checkout with no repository above it, whose work-orders folder exists and
 * holds one folder per record the caller states — none at all for an empty
 * work-orders folder.
 */
const setupCheckout = ({ records = [] }: { records?: { name: string; branch: string }[] } = {}) => {
	const cwd = mkdtempSync(join(tmpdir(), 'lightsout-resolve-work-order-name-for-branch-'));
	const workOrders = join(cwd, '.lightsout', 'work-orders');

	mkdirSync(workOrders, { recursive: true });

	for (const { name, branch } of records) {
		const folder = join(workOrders, name);

		mkdirSync(folder, { recursive: true });
		writeFileSync(join(folder, 'state.json'), JSON.stringify(workOrderStateOf({ name, branch })));
	}

	return { cwd };
};

describe('resolveWorkOrderNameForBranch', () => {
	test('answers the label of the local record that saves the branch, even when the branch carries a prefix the label does not', async () => {
		const { cwd } = setupCheckout({ records: [{ name: 'lo-140-multi', branch: 'feature/lo-140-multi' }] });

		const name = await resolveWorkOrderNameForBranch({ cwd, branch: 'feature/lo-140-multi' });

		expect(name).toBe('lo-140-multi');
	});

	test.each([
		{ scenario: 'an empty work-orders folder', records: [] },
		{ scenario: "a folder holding only another branch's record", records: [{ name: 'lo-141-other', branch: 'feature/lo-141-other' }] },
	])('answers the branch itself when no local record saves it', async ({ records }) => {
		const { cwd } = setupCheckout({ records });

		const name = await resolveWorkOrderNameForBranch({ cwd, branch: 'feature/lo-140-multi' });

		expect(name).toBe('feature/lo-140-multi');
	});
});
