import { describe, expect, jest, test } from '@jest/globals';

const mockGetProfile = jest.fn<() => string>();

// Correct: the setup factory sets the mock's return value and returns the
// subject as a const, and the test acts and asserts.
const setupSubject = () => {
	mockGetProfile.mockReturnValue('p.png');

	return { subject: mockGetProfile() };
};

describe('subject', () => {
	test('reads the profile', () => {
		const { subject } = setupSubject();

		expect(subject).toBe('p.png');
	});
});
