import { describe, expect, test } from '@jest/globals';
import { setupCloneSpansInput, setupSyntaxTreeInput } from '@lightsout/standards-testkit';
import { check } from './check.ts';

const forwardingMember = `	setStep({ step, index, total, label }: { step: string; index: number; total: number; label: string }): Promise<void> {
		return this.runState.setStep({ step, index, total, label });
	}`;

const computingMember = `	total({ records }: { records: { amount: number; fee: number; active: boolean }[] }): number {
		let sum = 0;
		for (const record of records) {
			if (record.active && record.amount > 0) {
				sum += record.amount * 2 - record.fee;
			}
		}
		return sum;
	}`;

/** Two classes holding the same collaborator, identical but for their names, and the span the engine reports across them. */
const setupClassCopy = ({ body }: { body: string }) => {
	const classOf = ({ name }: { name: string }) => `export class ${name} {
	private readonly runState: RunState;

	constructor({ runState }: { runState: RunState }) {
		this.runState = runState;
	}

	update({ patch, reason, actor, timestamp }: { patch: object; reason: string; actor: string; timestamp: number }): Promise<void> {
		return this.runState.update({ patch, reason, actor, timestamp });
	}

${body}
}
`;
	const pipeline = classOf({ name: 'PipelineRun' });
	const endLine = pipeline.split('\n').length - 1;

	return {
		spans: setupCloneSpansInput({
			spans: [
				{
					files: [
						{ path: 'src/PipelineRun.ts', startLine: 2, endLine },
						{ path: 'src/RefactorRun.ts', startLine: 2, endLine },
					],
					tokens: 150,
				},
			],
		}),
		trees: setupSyntaxTreeInput({
			sources: [
				['src/PipelineRun.ts', pipeline],
				['src/RefactorRun.ts', classOf({ name: 'RefactorRun' })],
			],
		}),
	};
};

describe('duplicate-code-block check', () => {
	test('needs the spans the engine detected, and uses syntax trees, when there are any, to tell a forwarding member from other code', () => {
		expect({ required: check.inputKinds, optional: check.optionalInputKinds }).toStrictEqual({ required: ['clone-spans'], optional: ['syntax-tree'] });
	});

	test('reports one duplicated block as a finding naming both sides and how long the copy is', async () => {
		const input = setupCloneSpansInput({
			spans: [
				{
					files: [
						{ path: 'src/a/alpha.ts', startLine: 10, endLine: 24 },
						{ path: 'src/b/beta.ts', startLine: 3, endLine: 17 },
					],
					tokens: 120,
				},
			],
		});

		const findings = await check.run({ inputs: { 'clone-spans': input }, options: { minTokens: 50 } });

		expect(findings).toStrictEqual([
			{
				siteKey: 'duplicate-code-block:src/a/alpha.ts|src/b/beta.ts',
				files: [
					{ path: 'src/a/alpha.ts', startLine: 10, endLine: 24 },
					{ path: 'src/b/beta.ts', startLine: 3, endLine: 17 },
				],
				detail: '1 duplicated block(s), the longest 15 lines',
				guidance: 'The same code is written out in both files. Write it once where both can import it.',
			},
		]);
	});

	test('a second copy between the same two files joins the finding they already have, and the longest span is the one reported', async () => {
		const input = setupCloneSpansInput({
			spans: [
				{
					files: [
						{ path: 'src/a/alpha.ts', startLine: 10, endLine: 14 },
						{ path: 'src/b/beta.ts', startLine: 3, endLine: 7 },
					],
					tokens: 60,
				},
				{
					files: [
						{ path: 'src/a/alpha.ts', startLine: 40, endLine: 59 },
						{ path: 'src/b/beta.ts', startLine: 30, endLine: 49 },
					],
					tokens: 180,
				},
			],
		});

		const findings = await check.run({ inputs: { 'clone-spans': input }, options: { minTokens: 50 } });

		expect(findings).toStrictEqual([
			{
				siteKey: 'duplicate-code-block:src/a/alpha.ts|src/b/beta.ts',
				files: [
					{ path: 'src/a/alpha.ts', startLine: 10, endLine: 14 },
					{ path: 'src/b/beta.ts', startLine: 3, endLine: 7 },
					{ path: 'src/a/alpha.ts', startLine: 40, endLine: 59 },
					{ path: 'src/b/beta.ts', startLine: 30, endLine: 49 },
				],
				detail: '2 duplicated block(s), the longest 20 lines',
				guidance: 'The same code is written out in both files. Write it once where both can import it.',
			},
		]);
	});

	test('a shorter copy found after a longer one leaves the reported length at the longer one', async () => {
		const input = setupCloneSpansInput({
			spans: [
				{
					files: [
						{ path: 'src/a/alpha.ts', startLine: 10, endLine: 39 },
						{ path: 'src/b/beta.ts', startLine: 3, endLine: 32 },
					],
					tokens: 240,
				},
				{
					files: [
						{ path: 'src/a/alpha.ts', startLine: 60, endLine: 64 },
						{ path: 'src/b/beta.ts', startLine: 50, endLine: 54 },
					],
					tokens: 60,
				},
			],
		});

		const findings = await check.run({ inputs: { 'clone-spans': input }, options: { minTokens: 50 } });

		expect(findings[0]?.detail).toBe('2 duplicated block(s), the longest 30 lines');
	});

	test('a span whose two sides differ in length is measured by the longer one', async () => {
		const input = setupCloneSpansInput({
			spans: [
				{
					files: [
						{ path: 'src/a/alpha.ts', startLine: 10, endLine: 15 },
						{ path: 'src/b/beta.ts', startLine: 3, endLine: 11 },
					],
					tokens: 70,
				},
			],
		});

		const findings = await check.run({ inputs: { 'clone-spans': input }, options: { minTokens: 50 } });

		expect(findings[0]?.detail).toBe('1 duplicated block(s), the longest 9 lines');
	});

	test('the same pair reported with its sides the other way round is still one finding', async () => {
		const input = setupCloneSpansInput({
			spans: [
				{
					files: [
						{ path: 'src/a/alpha.ts', startLine: 10, endLine: 14 },
						{ path: 'src/b/beta.ts', startLine: 3, endLine: 7 },
					],
					tokens: 60,
				},
				{
					files: [
						{ path: 'src/b/beta.ts', startLine: 30, endLine: 34 },
						{ path: 'src/a/alpha.ts', startLine: 40, endLine: 44 },
					],
					tokens: 60,
				},
			],
		});

		const findings = await check.run({ inputs: { 'clone-spans': input }, options: { minTokens: 50 } });

		expect(findings.map(({ siteKey, files }) => ({ siteKey, sites: files.length }))).toStrictEqual([
			{ siteKey: 'duplicate-code-block:src/a/alpha.ts|src/b/beta.ts', sites: 4 },
		]);
	});

	test('copies between different pairs of files are separate findings, one per pair', async () => {
		const input = setupCloneSpansInput({
			spans: [
				{
					files: [
						{ path: 'src/a/alpha.ts', startLine: 10, endLine: 14 },
						{ path: 'src/b/beta.ts', startLine: 3, endLine: 7 },
					],
					tokens: 60,
				},
				{
					files: [
						{ path: 'src/a/alpha.ts', startLine: 40, endLine: 44 },
						{ path: 'src/c/gamma.ts', startLine: 8, endLine: 12 },
					],
					tokens: 60,
				},
			],
		});

		const findings = await check.run({ inputs: { 'clone-spans': input }, options: { minTokens: 50 } });

		expect(findings.map(({ siteKey }) => siteKey)).toStrictEqual([
			'duplicate-code-block:src/a/alpha.ts|src/b/beta.ts',
			'duplicate-code-block:src/a/alpha.ts|src/c/gamma.ts',
		]);
	});

	test('a repo the detector found no copy in earns no finding', async () => {
		const input = setupCloneSpansInput({ spans: [] });

		const findings = await check.run({ inputs: { 'clone-spans': input }, options: { minTokens: 50 } });

		expect(findings).toStrictEqual([]);
	});

	test('reports nothing when its input is missing rather than refusing', async () => {
		const findings = await check.run({ inputs: {}, options: { minTokens: 50 } });

		expect(findings).toStrictEqual([]);
	});

	test('a copy made only of members that forward to a held collaborator is no finding, since composition repeats them by design', async () => {
		const { spans, trees } = setupClassCopy({ body: forwardingMember });

		const findings = await check.run({ inputs: { 'clone-spans': spans, 'syntax-tree': trees }, options: { minTokens: 50 } });

		expect(findings).toStrictEqual([]);
	});

	test('a copy that also repeats real code stays a finding', async () => {
		const { spans, trees } = setupClassCopy({ body: computingMember });

		const findings = await check.run({ inputs: { 'clone-spans': spans, 'syntax-tree': trees }, options: { minTokens: 50 } });

		expect(findings.map((finding) => finding.siteKey)).toStrictEqual(['duplicate-code-block:src/PipelineRun.ts|src/RefactorRun.ts']);
	});

	test('with no syntax trees to read, a copy made only of forwarding members is still reported', async () => {
		const { spans } = setupClassCopy({ body: forwardingMember });

		const findings = await check.run({ inputs: { 'clone-spans': spans }, options: { minTokens: 50 } });

		expect(findings.length).toBe(1);
	});
});
