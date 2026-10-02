import { beforeEach, describe, expect, jest, test } from '@jest/globals';

const mockGetProfile = jest.fn<() => string>();

// Incorrect: the subject lives in a shared variable the hook reassigns, and the
// hook also sets the mock's return value and asserts, so the test below states
// none of its own arrangement.
let subject: string;

describe('subject', () => {
	beforeEach(() => {
		mockGetProfile.mockReturnValue('p.png');
		subject = mockGetProfile();
		expect(subject).toBe('p.png');
	});

	test('reads the profile', () => {
		expect(subject).toBe('p.png');
	});
});
