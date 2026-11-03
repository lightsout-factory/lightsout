import { describe, expect, test } from '@jest/globals';
import { setupImportGraphInput } from '@lightsout/standards-testkit';
import { check } from './check.ts';

describe('feature-layout check', () => {
	test('asks for the import graph alone, since what a route reaches is read from its imports', () => {
		expect(check.inputKinds).toStrictEqual(['import-graph']);
	});

	test('reports a route importing from a feature folder it may not reach, naming the route and the file', async () => {
		const input = setupImportGraphInput({ edges: [{ from: 'src/routes/issues.tsx', to: 'src/features/issues/components/IssuesScreen.tsx' }] });

		const findings = await check.run({ inputs: { 'import-graph': input }, options: {} });

		expect(findings).toStrictEqual([
			{
				siteKey: 'feature-layout:src/features/issues/components/IssuesScreen.tsx|src/routes/issues.tsx',
				files: [{ path: 'src/routes/issues.tsx' }, { path: 'src/features/issues/components/IssuesScreen.tsx' }],
				detail: "route 'issues.tsx' imports 'features/issues/components/IssuesScreen.tsx' from its components/",
				guidance: "A route never reaches into a feature's components/ or hooks/: render the screen and let it compose them.",
			},
		]);
	});

	test('reports a route importing a hook', async () => {
		const input = setupImportGraphInput({ edges: [{ from: 'src/routes/issues.tsx', to: 'src/features/issues/hooks/useIssues.ts' }] });

		const findings = await check.run({ inputs: { 'import-graph': input }, options: {} });

		expect(findings.map(({ detail }) => detail)).toStrictEqual(["route 'issues.tsx' imports 'features/issues/hooks/useIssues.ts' from its hooks/"]);
	});

	test('lets a route reach screens/, queries/, utils/, constants/, types/ and server/, the shared layer, and lets everything but a route alone', async () => {
		const input = setupImportGraphInput({
			edges: [
				{ from: 'src/routes/issues.tsx', to: 'src/features/issues/screens/IssuesScreen.tsx' },
				{ from: 'src/routes/issues.tsx', to: 'src/features/issues/queries/issuesQueryOptions.ts' },
				{ from: 'src/routes/issues.tsx', to: 'src/features/issues/utils/parseIssuesSearch.ts' },
				{ from: 'src/routes/issues.tsx', to: 'src/features/issues/constants/issuesMeta.ts' },
				{ from: 'src/routes/issues.tsx', to: 'src/features/issues/types/IssuesSearch.ts' },
				{ from: 'src/routes/issues.tsx', to: 'src/queries/repoRootQueryOptions.ts' },
				{ from: 'src/routes/api.issues.ts', to: 'src/features/issues/server/findIssues.ts' },
				{ from: 'src/routes/__root.tsx', to: 'src/layouts/RootDocument.tsx' },
				{ from: 'src/features/issues/screens/IssuesScreen.tsx', to: 'src/features/issues/hooks/useIssueFilters.ts' },
				{ from: 'src/routes/issues.unit.test.tsx', to: 'src/features/issues/components/IssueRow.tsx' },
			],
			tests: ['src/routes/issues.unit.test.tsx'],
		});

		const findings = await check.run({ inputs: { 'import-graph': input }, options: {} });

		expect(findings).toStrictEqual([]);
	});

	test('reads each file’s place inside its own package', async () => {
		const input = setupImportGraphInput({
			edges: [{ from: 'packages/web-app/src/routes/issues.tsx', to: 'packages/web-app/src/features/issues/hooks/useIssues.ts' }],
			dependencies: [['packages/web-app', ['@tanstack/react-start']]],
		});

		const findings = await check.run({ inputs: { 'import-graph': input }, options: {} });

		expect(findings.map(({ siteKey }) => siteKey)).toStrictEqual([
			'feature-layout:packages/web-app/src/features/issues/hooks/useIssues.ts|packages/web-app/src/routes/issues.tsx',
		]);
	});

	test('reports nothing when handed no import graph', async () => {
		const findings = await check.run({ inputs: {}, options: {} });

		expect(findings).toStrictEqual([]);
	});
});
