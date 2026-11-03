import { describe, expect, test } from '@jest/globals';
import { setupImportGraphInput } from '@lightsout/standards-testkit';
import { check } from './check.ts';

describe('feature-import-direction check', () => {
	test('asks for the import graph alone, since direction is read from the two ends of an import', () => {
		expect(check.inputKinds).toStrictEqual(['import-graph']);
	});

	test('reports a feature importing from another feature, naming both files', async () => {
		const input = setupImportGraphInput({
			edges: [{ from: 'src/features/billing/components/InvoiceRow.tsx', to: 'src/features/issues/components/StatusBadge.tsx' }],
		});

		const findings = await check.run({ inputs: { 'import-graph': input }, options: {} });

		expect(findings).toStrictEqual([
			{
				siteKey: 'feature-import-direction:src/features/billing/components/InvoiceRow.tsx|src/features/issues/components/StatusBadge.tsx',
				files: [{ path: 'src/features/billing/components/InvoiceRow.tsx' }, { path: 'src/features/issues/components/StatusBadge.tsx' }],
				detail: "'InvoiceRow.tsx' in feature 'billing' imports from feature 'issues'",
				guidance: 'Move what both features need into the shared layer and import it from there.',
			},
		]);
	});

	test('reports the shared layer importing from a feature', async () => {
		const input = setupImportGraphInput({ edges: [{ from: 'src/components/ui/StatusBadge.tsx', to: 'src/features/issues/constants/IssueStatus.ts' }] });

		const findings = await check.run({ inputs: { 'import-graph': input }, options: {} });

		expect(findings.map(({ detail }) => detail)).toStrictEqual(["'StatusBadge.tsx' in the shared layer imports from feature 'issues'"]);
	});

	test('lets imports flow the right way: within a feature, feature to shared, and the app above to anything', async () => {
		const input = setupImportGraphInput({
			edges: [
				{ from: 'src/features/issues/screens/IssuesScreen.tsx', to: 'src/features/issues/components/IssueRow.tsx' },
				{ from: 'src/features/issues/components/IssueRow.tsx', to: 'src/components/ui/StatusBadge.tsx' },
				{ from: 'src/routes/issues.tsx', to: 'src/features/issues/screens/IssuesScreen.tsx' },
				{ from: 'src/router.tsx', to: 'src/features/issues/screens/IssuesScreen.tsx' },
				{ from: 'src/server/getReader.ts', to: 'src/features/issues/types/Issue.ts' },
				{ from: 'src/components/ui/Button.tsx', to: 'src/utils/cn.ts' },
			],
		});

		const findings = await check.run({ inputs: { 'import-graph': input }, options: {} });

		expect(findings).toStrictEqual([]);
	});

	test('ignores an import from or to a test, and one that crosses packages', async () => {
		const input = setupImportGraphInput({
			edges: [
				{ from: 'src/features/billing/components/InvoiceRow.unit.test.tsx', to: 'src/features/issues/components/StatusBadge.tsx' },
				{ from: 'packages/web-app/src/features/billing/components/InvoiceRow.tsx', to: 'packages/shared/src/features/issues/types/Issue.ts' },
			],
			tests: ['src/features/billing/components/InvoiceRow.unit.test.tsx'],
			dependencies: [
				['packages/web-app', ['react']],
				['packages/shared', []],
			],
		});

		const findings = await check.run({ inputs: { 'import-graph': input }, options: {} });

		expect(findings).toStrictEqual([]);
	});

	test('reports nothing when handed no import graph', async () => {
		const findings = await check.run({ inputs: {}, options: {} });

		expect(findings).toStrictEqual([]);
	});
});
