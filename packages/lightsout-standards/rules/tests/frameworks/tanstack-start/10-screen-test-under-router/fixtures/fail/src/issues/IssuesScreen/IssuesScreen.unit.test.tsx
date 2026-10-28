import { describe, expect, jest, test } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { IssuesScreen } from './IssuesScreen.tsx';

const mockUseSuspenseQuery = jest.fn<() => { data: Array<{ id: number; title: string }> }>();

// Incorrect: with the query hook and the router mocked away, the screen under
// test is not the one the route renders — its key, loader and links are gone.
jest.mock('@tanstack/react-query', () => ({ useSuspenseQuery: () => mockUseSuspenseQuery() }));
jest.mock('@tanstack/react-router', () => ({ Link: ({ children }: { children: string }) => children }));

const setupIssuesScreen = () => {
	mockUseSuspenseQuery.mockReturnValue({ data: [{ id: 1, title: 'Login fails' }] });
	render(<IssuesScreen />);
};

describe('IssuesScreen', () => {
	test('lists each issue by title', () => {
		setupIssuesScreen();

		const row = screen.getByText('Login fails');

		expect(row).toBeInTheDocument();
	});
});
