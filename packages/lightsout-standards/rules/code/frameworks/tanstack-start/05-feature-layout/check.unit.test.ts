import { describe, expect, test } from '@jest/globals';
import { setupFileListInput } from '@lightsout/standards-testkit';
import { check } from './check.ts';

describe('feature-layout check', () => {
	test('asks for the file list alone, since a layer is read from its path', () => {
		expect(check.inputKinds).toStrictEqual(['file-list']);
	});

	test('reports a folder that sorts a feature by kind, naming the folder', async () => {
		const input = setupFileListInput({ files: ['src/issues/IssuesScreen/components/IssueRow.tsx'] });

		const findings = await check.run({ inputs: { 'file-list': input }, options: {} });

		expect(findings).toStrictEqual([
			{
				siteKey: 'feature-layout:src/issues/IssuesScreen/components',
				files: [{ path: 'src/issues/IssuesScreen/components' }],
				detail: "folder 'components' is a layer named for a kind of code",
				guidance:
					'Move its files up a level, beside the module that uses them, and let each file name say what it is: a Screen suffix, a QueryOptions suffix, a use prefix.',
			},
		]);
	});

	test('names every layer on the closed list, restated here so a name dropped from it stops enforcing loudly', async () => {
		const input = setupFileListInput({
			files: ['src/features/issues/screens/IssuesScreen.tsx', 'src/issues/hooks/useIssues.ts', 'src/issues/queries/issuesQueryOptions.ts'],
		});

		const findings = await check.run({ inputs: { 'file-list': input }, options: {} });

		expect(findings.map(({ siteKey }) => siteKey)).toStrictEqual([
			'feature-layout:src/features',
			'feature-layout:src/features/issues/screens',
			'feature-layout:src/issues/hooks',
			'feature-layout:src/issues/queries',
		]);
	});

	test('leaves the folders the layout allows alone: a feature, a module, common/, routes/ and server/', async () => {
		const input = setupFileListInput({
			files: [
				'src/routes/issues.tsx',
				'src/issues/IssuesScreen/IssuesScreen.tsx',
				'src/issues/IssuesScreen/IssueRow.tsx',
				'src/issues/issuesQueryOptions.ts',
				'src/issues/server/findIssues.ts',
				'src/issues/common/types/Issue.ts',
			],
		});

		const findings = await check.run({ inputs: { 'file-list': input }, options: {} });

		expect(findings).toStrictEqual([]);
	});

	test('judges only the source tree of each package, so a test helper tree outside src/ is not its to report', async () => {
		const input = setupFileListInput({
			files: [
				'tests/helpers/components/renderWithRouter.tsx',
				'packages/web-app/tests/components/stub.tsx',
				'packages/web-app/src/issues/components/IssueRow.tsx',
			],
			dependencies: [['packages/web-app', ['react']]],
		});

		const findings = await check.run({ inputs: { 'file-list': input }, options: {} });

		expect(findings.map(({ siteKey }) => siteKey)).toStrictEqual(['feature-layout:packages/web-app/src/issues/components']);
	});

	test('reports nothing when handed no file list', async () => {
		const findings = await check.run({ inputs: {}, options: {} });

		expect(findings).toStrictEqual([]);
	});
});
