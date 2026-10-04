import { describe, expect, test } from '@jest/globals';
import { setupSyntaxTreeInput } from '@lightsout/standards-testkit';
import { check } from './check.ts';

describe('index-file-contents check: code in an index file', () => {
	test('reports an index file that grew into a program, counting its statements and naming the first line', async () => {
		const input = setupSyntaxTreeInput({
			sources: [
				[
					'src/cli/index.ts',
					["import { doctorCommand } from './doctorCommand';", '', 'const commands = { doctor: doctorCommand };', '', 'await commands.doctor();'].join('\n'),
				],
			],
		});

		const findings = await check.run({ inputs: { 'syntax-tree': input }, options: {} });

		expect(findings).toStrictEqual([
			{
				siteKey: 'index-file-contents:src/cli/index.ts',
				files: [{ path: 'src/cli/index.ts' }],
				detail: '3 statement(s) other than re-export lines, the first at line 1',
				guidance: 'An index file holds re-export lines only. Put executable code in a named entry file such as main.ts.',
			},
		]);
	});

	test('leaves a pure index file alone, the multi-line type re-export and comments included', async () => {
		const input = setupSyntaxTreeInput({
			sources: [
				[
					'src/doctor/index.ts',
					[
						'// The doctor module’s public surface.',
						"export { runDoctor } from './runDoctor';",
						'export type {',
						'\tDoctorReport,',
						"} from './DoctorReport';",
					].join('\n'),
				],
			],
		});

		const findings = await check.run({ inputs: { 'syntax-tree': input }, options: {} });

		expect(findings).toStrictEqual([]);
	});

	test('leaves `export *` to the file-text half, so one star line never reports twice', async () => {
		const input = setupSyntaxTreeInput({ sources: [['src/feature/index.ts', "export * from './renderGreeting';"]] });

		const findings = await check.run({ inputs: { 'syntax-tree': input }, options: {} });

		expect(findings).toStrictEqual([]);
	});

	test('reports an index that imports and re-exports separately, since neither line is a re-export line', async () => {
		const input = setupSyntaxTreeInput({
			sources: [['src/reporting/index.ts', ["import { buildReport } from './buildReport';", '', 'export { buildReport };'].join('\n')]],
		});

		const findings = await check.run({ inputs: { 'syntax-tree': input }, options: {} });

		expect(findings).toStrictEqual([
			{
				siteKey: 'index-file-contents:src/reporting/index.ts',
				files: [{ path: 'src/reporting/index.ts' }],
				detail: '2 statement(s) other than re-export lines, the first at line 1',
				guidance: 'An index file holds re-export lines only. Put executable code in a named entry file such as main.ts.',
			},
		]);
	});

	test('reports a component’s index.tsx, which is an index file like any other', async () => {
		const input = setupSyntaxTreeInput({
			sources: [['src/features/Dashboard/index.tsx', 'export const Dashboard = () => <section />;']],
		});

		const findings = await check.run({ inputs: { 'syntax-tree': input }, options: {} });

		expect(findings).toStrictEqual([
			{
				siteKey: 'index-file-contents:src/features/Dashboard/index.tsx',
				files: [{ path: 'src/features/Dashboard/index.tsx' }],
				detail: '1 statement(s) other than re-export lines, the first at line 1',
				guidance: 'An index file holds re-export lines only. Put executable code in a named entry file such as main.ts.',
			},
		]);
	});

	test('reports a src root index holding code — the doorway rule has no root exemption', async () => {
		const input = setupSyntaxTreeInput({ sources: [['src/index.ts', "console.log('boot');"]] });

		const findings = await check.run({ inputs: { 'syntax-tree': input }, options: {} });

		expect(findings).toStrictEqual([
			{
				siteKey: 'index-file-contents:src/index.ts',
				files: [{ path: 'src/index.ts' }],
				detail: '1 statement(s) other than re-export lines, the first at line 1',
				guidance: 'An index file holds re-export lines only. Put executable code in a named entry file such as main.ts.',
			},
		]);
	});

	test('reports an index under common/ holding code like any other', async () => {
		const input = setupSyntaxTreeInput({ sources: [['src/billing/common/utils/index.ts', "console.log('boot');"]] });

		const findings = await check.run({ inputs: { 'syntax-tree': input }, options: {} });

		expect(findings.map(({ siteKey }) => siteKey)).toStrictEqual(['index-file-contents:src/billing/common/utils/index.ts']);
	});

	test('says nothing about a named entry file, which is exactly where the code belongs', async () => {
		const input = setupSyntaxTreeInput({
			sources: [['src/main.ts', ["import { runDoctor } from './doctor';", '', 'await runDoctor();'].join('\n')]],
		});

		const findings = await check.run({ inputs: { 'syntax-tree': input }, options: {} });

		expect(findings).toStrictEqual([]);
	});

	test('reports nothing when its input is missing rather than refusing', async () => {
		const findings = await check.run({ inputs: {}, options: {} });

		expect(findings).toStrictEqual([]);
	});
});
