import { describe, expect, jest, test } from '@jest/globals';
import type { ConfigView } from '@lightsout/engine';
import { StandardsSeverity } from '@lightsout/engine/contracts';
import { render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { RuleLedger } from '#src/features/config/screens/ConfigPage/internal/components/RuleLedger.tsx';
import { buildConfigView } from '#tests/helpers/buildConfigView.ts';

// Mocked Imports
// -------------------------
// Every rule in the ledger is a link into the pack pages, and a link needs a
// live router to resolve a path. A plain anchor keeps the assertions about the
// rows rather than about the routing library.
jest.mock('@tanstack/react-router', () => ({
	Link: ({ to, params, children, className }: { to: string; params?: Record<string, string>; children: ReactNode; className?: string }) => (
		<a href={Object.entries(params ?? {}).reduce((path, [name, value]) => path.replace(`$${name}`, value), to)} className={className}>
			{children}
		</a>
	),
}));
// -------------------------

/** One rule split across two package groups, each at its own severity, as `listStandardsRules` lists it. */
const setupSplitRule = () => {
	const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
	const [base] = buildConfigView().ruleStates;
	const ruleStates: ConfigView['ruleStates'] = [
		{
			...base,
			severity: StandardsSeverity.Blocking,
			packages: ['', 'engine'],
			appliesTo: 'repo root (outside packages), engine',
		},
		{
			...base,
			severity: StandardsSeverity.Advisory,
			packages: ['web-app'],
			appliesTo: 'web-app',
		},
	];

	render(<RuleLedger ruleStates={ruleStates} />);

	return { consoleError };
};

describe('RuleLedger', () => {
	test('shows a rule once per package set, with the packages each row applies to', () => {
		const { consoleError } = setupSplitRule();

		const headers = screen.getAllByRole('columnheader').map((header) => header.textContent);
		const appliesToIndex = headers.indexOf('applies to');
		const bodyRows = screen.getAllByRole('row').slice(1);
		const rows = bodyRows.map((row) => ({
			rule: within(row).getByRole('link').textContent,
			appliesTo: within(row).getAllByRole('cell')[appliesToIndex]?.textContent,
		}));
		const duplicateKeyWarnings = consoleError.mock.calls.filter((call) => call.some((part) => String(part).includes('same key')));

		expect(appliesToIndex).toBeGreaterThanOrEqual(0);
		expect(rows).toStrictEqual([
			{ rule: 'lightsout/file-size', appliesTo: 'repo root (outside packages), engine' },
			{ rule: 'lightsout/file-size', appliesTo: 'web-app' },
		]);
		expect(duplicateKeyWarnings).toStrictEqual([]);
	});
});
