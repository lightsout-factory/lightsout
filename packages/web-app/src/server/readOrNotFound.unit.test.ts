/**
 * @jest-environment node
 */
import { describe, expect, test } from '@jest/globals';
import { isNotFound } from '@tanstack/react-router';
import { readOrNotFound } from '#src/server/readOrNotFound.ts';

class AddressMissingError extends Error {}

/** What a read threw, so a test can assert on a refusal that is not always an `Error`. */
const catchRefusal = async ({ thrown }: { thrown: Error }): Promise<unknown> => {
	try {
		await readOrNotFound({ read: () => Promise.reject(thrown), absent: [AddressMissingError] });
	} catch (error) {
		return error;
	}

	throw new Error('the read resolved where it should have refused');
};

describe('readOrNotFound', () => {
	test('hands back what the read resolved to', async () => {
		const result = await readOrNotFound({ read: () => Promise.resolve('the plan'), absent: [AddressMissingError] });

		expect(result).toBe('the plan');
	});

	test("answers an absence error with the router's not-found signal", async () => {
		const refusal = await catchRefusal({ thrown: new AddressMissingError('no such plan') });

		expect(isNotFound(refusal)).toBe(true);
	});

	test('rethrows any other failure untouched, so a broken read is never reported as a missing page', async () => {
		const failure = new Error('the disk is unreadable');

		const refusal = await catchRefusal({ thrown: failure });

		expect(refusal).toBe(failure);
	});
});
