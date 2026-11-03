import { describe, expect, test } from '@jest/globals';
import { setupFileListInput } from '@lightsout/standards-testkit';
import { check } from './check.ts';

describe('component-folder check', () => {
	test('asks for the file list alone, since a component folder is told by a file of its own name', () => {
		expect(check.inputKinds).toStrictEqual(['file-list']);
	});

	test('reports a folder nested inside a component folder', async () => {
		const input = setupFileListInput({
			files: ['src/features/issues/components/IssueCard/IssueCard.tsx', 'src/features/issues/components/IssueCard/Header/IssueCardHeader.tsx'],
		});

		const findings = await check.run({ inputs: { 'file-list': input }, options: {} });

		expect(findings).toStrictEqual([
			{
				siteKey: 'component-folder:src/features/issues/components/IssueCard/Header',
				files: [{ path: 'src/features/issues/components/IssueCard/Header' }],
				detail: "folder 'Header' sits inside component folder 'IssueCard'",
				guidance: 'A part with parts of its own is a component in its own right: move it up to components/ and give it a folder of its own there.',
			},
		]);
	});

	test('reports a component folder down to its main file, and a folder in a feature’s components/ with no component of its name', async () => {
		const input = setupFileListInput({
			files: [
				'src/features/issues/components/IssueFooter/IssueFooter.tsx',
				'src/features/issues/components/IssueFooter/IssueFooter.unit.test.tsx',
				'src/features/issues/components/cards/IssueCard.tsx',
			],
			tests: ['src/features/issues/components/IssueFooter/IssueFooter.unit.test.tsx'],
		});

		const findings = await check.run({ inputs: { 'file-list': input }, options: {} });

		expect(findings.map(({ siteKey, detail }) => ({ siteKey, detail }))).toStrictEqual([
			{ siteKey: 'component-folder:src/features/issues/components/IssueFooter', detail: "folder 'IssueFooter' holds only its main file" },
			{ siteKey: 'component-folder:src/features/issues/components/cards', detail: "folder 'cards' in components/ has no component of its name" },
		]);
	});

	test('leaves a component folder with parts alone, a group under the shared components/, and folders with no components/ above them', async () => {
		const input = setupFileListInput({
			files: [
				'src/features/issues/components/IssueCard/IssueCard.tsx',
				'src/features/issues/components/IssueCard/IssueCardHeader.tsx',
				'src/features/issues/components/IssueCard/useIssueCardState.ts',
				'src/components/ui/Button.tsx',
				'src/components/ui/DataTable/DataTable.tsx',
				'src/components/ui/DataTable/DataTableRow.tsx',
				'src/features/issues/hooks/filters/useIssueFilters.ts',
			],
		});

		const findings = await check.run({ inputs: { 'file-list': input }, options: {} });

		expect(findings).toStrictEqual([]);
	});

	test('reads each folder’s place inside its own package', async () => {
		const input = setupFileListInput({
			files: ['packages/web-app/src/features/issues/components/IssueFooter/IssueFooter.tsx'],
			dependencies: [['packages/web-app', ['react']]],
		});

		const findings = await check.run({ inputs: { 'file-list': input }, options: {} });

		expect(findings.map(({ siteKey }) => siteKey)).toStrictEqual(['component-folder:packages/web-app/src/features/issues/components/IssueFooter']);
	});

	test('reports nothing when handed no file list', async () => {
		const findings = await check.run({ inputs: {}, options: {} });

		expect(findings).toStrictEqual([]);
	});
});
