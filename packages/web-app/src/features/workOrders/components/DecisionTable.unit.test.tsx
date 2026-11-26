import { describe, expect, test } from '@jest/globals';
import { type DecisionRow, DecisionSource } from '@lightsout/engine/contracts';
import { render, screen, within } from '@testing-library/react';
import { DecisionTable } from '#src/features/workOrders/components/DecisionTable.tsx';

const setupDecisionTable = () => {
	const rows: DecisionRow[] = [
		{
			source: DecisionSource.Brainstorm,
			question: 'Which pages does the browser have?',
			options: 'Four pages / Eight pages',
			choice: 'Four pages',
			rationale: 'The outline the user gave.',
			assumption: false,
		},
		{
			source: DecisionSource.Converge,
			question: 'How often do pages refresh?',
			options: 'Always poll / Poll while live',
			choice: 'Poll while live',
			rationale: 'Avoids rescanning idle state.',
			assumption: true,
		},
	];
	render(<DecisionTable rows={rows} />);
};

describe('DecisionTable', () => {
	test('renders one row per decision and tags only an assumption', () => {
		setupDecisionTable();

		const drawn = screen
			.getAllByRole('row')
			.filter((row) => within(row).queryAllByRole('cell').length > 0)
			.map((row) => ({ text: row.textContent, tagged: within(row).queryByText(/assumption/i) !== null }));

		expect(drawn).toStrictEqual([
			{ text: expect.stringMatching(/Which pages does the browser have\?.*Four pages.*The outline the user gave\./), tagged: false },
			{ text: expect.stringMatching(/How often do pages refresh\?.*Poll while live.*Avoids rescanning idle state\./), tagged: true },
		]);
	});
});
