import { describe, expect, test } from '@jest/globals';
import { setupFileListInput } from '@lightsout/standards-testkit';
import { check } from './check.ts';

describe('shared-layer check', () => {
	test('asks for the file list alone, since the top of src/ is read from its paths', () => {
		expect(check.inputKinds).toStrictEqual(['file-list']);
	});

	test('reports a top-level folder the shared layer does not hold, naming the folder once', async () => {
		const input = setupFileListInput({ files: ['src/shared/StatusBadge.tsx', 'src/shared/formatCount.ts'] });

		const findings = await check.run({ inputs: { 'file-list': input }, options: {} });

		expect(findings).toStrictEqual([
			{
				siteKey: 'shared-layer:src/shared',
				files: [{ path: 'src/shared' }],
				detail: "folder 'shared' is not one the top of src/ holds",
				guidance:
					"Move its files into a feature, or into a shared folder named for its kind: components/, layouts/, providers/, hooks/, utils/, types/, constants/, styles/ or assets/, or a folder the framework's rules add.",
			},
		]);
	});

	test('reports a folder grouping files inside a flat shared folder', async () => {
		const input = setupFileListInput({ files: ['src/hooks/theme/useTheme.ts', 'src/utils/formatCount.ts'] });

		const findings = await check.run({ inputs: { 'file-list': input }, options: {} });

		expect(findings.map(({ siteKey, detail }) => ({ siteKey, detail }))).toStrictEqual([
			{ siteKey: 'shared-layer:src/hooks/theme', detail: "folder 'theme' groups files inside hooks/" },
		]);
	});

	test('lets components/ group by subject and hold component folders, but not a group inside a group', async () => {
		const input = setupFileListInput({
			files: [
				'src/components/ui/Button.tsx',
				'src/components/ui/DataTable/DataTable.tsx',
				'src/components/ui/DataTable/DataTableRow.tsx',
				'src/components/icons/forms/CheckIcon.tsx',
				'src/components/Markdown/Markdown.tsx',
				'src/components/Markdown/CodeBlock.tsx',
			],
		});

		const findings = await check.run({ inputs: { 'file-list': input }, options: {} });

		expect(findings.map(({ siteKey, detail }) => ({ siteKey, detail }))).toStrictEqual([
			{ siteKey: 'shared-layer:src/components/icons/forms', detail: "folder 'forms' groups files inside components/icons/" },
		]);
	});

	test('leaves a well-laid top of src/ alone: entry files, the shared folders, features and anything outside src/', async () => {
		const input = setupFileListInput({
			files: [
				'src/router.tsx',
				'src/components/ui/Button.tsx',
				'src/layouts/AppLayout.tsx',
				'src/providers/ThemeProvider.tsx',
				'src/hooks/useTheme.ts',
				'src/utils/cn.ts',
				'src/types/Theme.ts',
				'src/constants/themeStorageKey.ts',
				'src/styles/fonts/inter.css',
				'src/assets/logo.svg',
				'src/features/issues/anything/goes/here.ts',
				'src/hooks/useTheme.unit.test.ts',
				'tests/helpers/shared/stub.ts',
			],
			tests: ['src/hooks/useTheme.unit.test.ts'],
		});

		const findings = await check.run({ inputs: { 'file-list': input }, options: {} });

		expect(findings).toStrictEqual([]);
	});

	test('reads each file’s place inside its own package', async () => {
		const input = setupFileListInput({ files: ['packages/web-app/src/lib/cn.ts'], dependencies: [['packages/web-app', ['react']]] });

		const findings = await check.run({ inputs: { 'file-list': input }, options: {} });

		expect(findings.map(({ siteKey }) => siteKey)).toStrictEqual(['shared-layer:packages/web-app/src/lib']);
	});

	test('reports nothing when handed no file list', async () => {
		const findings = await check.run({ inputs: {}, options: {} });

		expect(findings).toStrictEqual([]);
	});
});
