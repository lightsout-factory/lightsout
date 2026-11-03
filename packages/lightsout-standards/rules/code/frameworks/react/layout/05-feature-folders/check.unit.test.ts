import { describe, expect, test } from '@jest/globals';
import { setupFileListInput } from '@lightsout/standards-testkit';
import { check } from './check.ts';

describe('feature-folders check', () => {
	test('asks for the file list alone, since a feature’s shape is read from its paths', () => {
		expect(check.inputKinds).toStrictEqual(['file-list']);
	});

	test('reports a folder a feature does not hold, naming the folder once', async () => {
		const input = setupFileListInput({ files: ['src/features/issues/ui/IssueRow.tsx', 'src/features/issues/ui/IssueBadge.tsx'] });

		const findings = await check.run({ inputs: { 'file-list': input }, options: {} });

		expect(findings).toStrictEqual([
			{
				siteKey: 'feature-folders:src/features/issues/ui',
				files: [{ path: 'src/features/issues/ui' }],
				detail: "folder 'ui' is not one a feature holds",
				guidance: "Move its files into screens/, components/, hooks/, utils/, types/ or constants/, or into a folder the framework's rules add.",
			},
		]);
	});

	test('reports a file directly under a feature, and one in features/ outside any feature', async () => {
		const input = setupFileListInput({ files: ['src/features/issues/IssuesScreen.tsx', 'src/features/formatIssue.ts'] });

		const findings = await check.run({ inputs: { 'file-list': input }, options: {} });

		expect(findings.map(({ siteKey, detail }) => ({ siteKey, detail }))).toStrictEqual([
			{ siteKey: 'feature-folders:src/features/formatIssue.ts', detail: "'formatIssue.ts' sits in features/ outside any feature" },
			{ siteKey: 'feature-folders:src/features/issues/IssuesScreen.tsx', detail: "'IssuesScreen.tsx' sits directly under feature 'issues'" },
		]);
	});

	test('reports a folder grouping files inside a kind folder, but leaves component folders to the component-folder rule', async () => {
		const input = setupFileListInput({
			files: ['src/features/issues/hooks/filters/useIssueFilters.ts', 'src/features/issues/components/IssueCard/IssueCard.tsx'],
		});

		const findings = await check.run({ inputs: { 'file-list': input }, options: {} });

		expect(findings.map(({ siteKey, detail }) => ({ siteKey, detail }))).toStrictEqual([
			{ siteKey: 'feature-folders:src/features/issues/hooks/filters', detail: "folder 'filters' groups files inside hooks/" },
		]);
	});

	test('leaves a well-laid feature alone, and judges nothing outside features/', async () => {
		const input = setupFileListInput({
			files: [
				'src/features/issues/screens/IssuesScreen.tsx',
				'src/features/issues/components/IssueRow.tsx',
				'src/features/issues/hooks/useIssueFilters.ts',
				'src/features/issues/utils/sortIssues.ts',
				'src/features/issues/types/Issue.ts',
				'src/features/issues/constants/IssueStatus.ts',
				'src/features/issues/screens/IssuesScreen.unit.test.tsx',
				'src/components/ui/Button.tsx',
				'src/routes/issues.tsx',
				'tests/helpers/features/issues/stub.ts',
			],
			tests: ['src/features/issues/screens/IssuesScreen.unit.test.tsx'],
		});

		const findings = await check.run({ inputs: { 'file-list': input }, options: {} });

		expect(findings).toStrictEqual([]);
	});

	test('reads each file’s place inside its own package', async () => {
		const input = setupFileListInput({
			files: ['packages/web-app/src/features/issues/ui/IssueRow.tsx'],
			dependencies: [['packages/web-app', ['react']]],
		});

		const findings = await check.run({ inputs: { 'file-list': input }, options: {} });

		expect(findings.map(({ siteKey }) => siteKey)).toStrictEqual(['feature-folders:packages/web-app/src/features/issues/ui']);
	});

	test('reports nothing when handed no file list', async () => {
		const findings = await check.run({ inputs: {}, options: {} });

		expect(findings).toStrictEqual([]);
	});
});
