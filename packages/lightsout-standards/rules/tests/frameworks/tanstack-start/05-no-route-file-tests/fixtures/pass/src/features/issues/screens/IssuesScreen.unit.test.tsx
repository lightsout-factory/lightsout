import { describe, expect, test } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { IssuesScreen } from './IssuesScreen';

const setupIssuesScreen = () => {
	render(<IssuesScreen />);
};

// Correct: the screen is tested, and the route that renders it is not.
describe('IssuesScreen', () => {
	test('renders the heading', () => {
		setupIssuesScreen();

		const heading = screen.getByRole('heading', { name: 'Issues' });

		expect(heading).toBeInTheDocument();
	});
});
