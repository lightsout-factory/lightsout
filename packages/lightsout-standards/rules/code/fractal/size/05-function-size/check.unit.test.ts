import { describe, expect, test } from '@jest/globals';
import { setupSyntaxTreeInput } from '@lightsout/standards-testkit';
import { check } from './check.ts';

/** The cap this suite measures against — small enough that a fixture stays readable. */
const caps = { function: 5 };

/** A named arrow spanning exactly `lines` lines, its body padded with statements nothing else depends on. */
const buildArrow = ({ name, lines }: { name: string; lines: number }) =>
	[`export const ${name} = () => {`, ...Array.from({ length: lines - 2 }, (_, index) => `\tconst step${index} = ${index};`), '};'].join('\n');

describe('function-size check', () => {
	test('asks for parsed trees, since only the parse says where a signature and its closing brace sit', () => {
		expect(check.inputKinds).toStrictEqual(['syntax-tree']);
	});

	test('reports a function past its cap, naming it, its span and the number it was measured against', async () => {
		const input = setupSyntaxTreeInput({ sources: [['src/reporting/buildReportSummary.ts', buildArrow({ name: 'buildReportSummary', lines: 6 })]] });

		const findings = await check.run({ inputs: { 'syntax-tree': input }, options: caps });

		expect(findings.map(({ siteKey, files, detail, measure }) => ({ siteKey, files, detail, measure }))).toStrictEqual([
			{
				siteKey: 'function-size:src/reporting/buildReportSummary.ts',
				files: [{ path: 'src/reporting/buildReportSummary.ts', startLine: 1, endLine: 6 }],
				detail: "function 'buildReportSummary' is 6 lines (cap ~5)",
				measure: 6,
			},
		]);
	});

	test('leaves a function measured to exactly its cap — the cap is the last allowed line, not the first banned one', async () => {
		const input = setupSyntaxTreeInput({ sources: [['src/reporting/buildReportSummary.ts', buildArrow({ name: 'buildReportSummary', lines: 5 })]] });

		const findings = await check.run({ inputs: { 'syntax-tree': input }, options: caps });

		expect(findings).toStrictEqual([]);
	});

	test.each([
		{ path: 'src/reporting/useReportRows.ts', name: 'useReportRows' },
		{ path: 'src/reporting/ReportPanel.tsx', name: 'ReportPanel' },
	])('measures $name on the one cap every function shares, whatever its name or file', async ({ path, name }) => {
		const input = setupSyntaxTreeInput({ sources: [[path, buildArrow({ name, lines: 6 })]] });

		const findings = await check.run({ inputs: { 'syntax-tree': input }, options: caps });

		expect(findings.map(({ detail }) => detail)).toStrictEqual([`function '${name}' is 6 lines (cap ~5)`]);
	});

	test('reads the cap from options', async () => {
		const input = setupSyntaxTreeInput({ sources: [['src/reporting/buildReportSummary.ts', buildArrow({ name: 'buildReportSummary', lines: 6 })]] });

		const findings = await check.run({ inputs: { 'syntax-tree': input }, options: { function: 6 } });

		expect(findings).toStrictEqual([]);
	});

	test('reports nothing when its input is missing rather than refusing', async () => {
		const findings = await check.run({ inputs: {}, options: caps });

		expect(findings).toStrictEqual([]);
	});
});
