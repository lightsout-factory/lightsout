import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { describe, expect, test } from '@jest/globals';
import { type StandardsCheckInput, StandardsInputKind } from '@lightsout/standards-contracts';
import { resolveConsumerTypescript } from '#src/common/workspace/resolveConsumerTypescript.ts';
import { buildCheckInput } from '#src/standardsCheck/internal/common/checkInputs/buildCheckInput.ts';
import { getRejectionError } from '#tests/helpers/getRejectionError.ts';

const setupRepo = () => {
	const cwd = mkdtempSync(join(tmpdir(), 'lightsout-check-input-'));

	mkdirSync(join(cwd, 'src'), { recursive: true });
	writeFileSync(join(cwd, 'src/alpha.ts'), 'export const alpha = 1;\n');
	writeFileSync(join(cwd, 'src/alpha.unit.test.ts'), "test('alpha', () => {});\n");

	return { cwd };
};

const compiler = resolveConsumerTypescript({ cwd: process.cwd() });

const buildInput = ({ kind, cwd, withCompiler = true }: { kind: StandardsInputKind; cwd: string; withCompiler?: boolean }) =>
	buildCheckInput({
		kind,
		cwd,
		source: ['src/alpha.ts'],
		tests: ['src/alpha.unit.test.ts'],
		files: ['src/alpha.ts', 'src/alpha.unit.test.ts'],
		referenceFiles: ['src/alpha.ts', 'src/alpha.unit.test.ts'],
		standardsPacks: [],
		packagesDir: 'packages',
		options: { minTokens: 50 },
		cache: new Map<string, string>(),
		compiler: withCompiler ? compiler : undefined,
	});

// Well past the detector's five-line floor, and about a hundred tokens long, so
// a low minTokens reports it as a duplicate block and a high one never does.
const duplicatedBody = `
	let total = 0;
	for (const record of records) {
		if (record.active && record.amount > 0) {
			total += record.amount * record.multiplier + record.bonus;
		} else if (record.pending) {
			total += record.amount / 2 - record.fee;
		} else {
			total -= record.penalty ?? 0;
		}
	}
	return total * 100;
`;

const setupDuplicateRepo = () => {
	const cwd = mkdtempSync(join(tmpdir(), 'lightsout-check-input-options-'));

	mkdirSync(join(cwd, 'src'), { recursive: true });
	writeFileSync(join(cwd, 'src/alpha.ts'), `export const alpha = ({ records }: { records: any[] }) => {${duplicatedBody}};\n`);
	writeFileSync(join(cwd, 'src/beta.ts'), `export const beta = ({ records }: { records: any[] }) => {${duplicatedBody}};\n`);
	writeFileSync(join(cwd, 'src/alpha.unit.test.ts'), "test('alpha', () => {});\n");

	return { cwd };
};

const buildInputWithOptions = ({ kind, cwd, options }: { kind: StandardsInputKind; cwd: string; options: Record<string, number> }) =>
	buildCheckInput({
		kind,
		cwd,
		source: ['src/alpha.ts', 'src/beta.ts'],
		tests: ['src/alpha.unit.test.ts'],
		files: ['src/alpha.ts', 'src/beta.ts', 'src/alpha.unit.test.ts'],
		referenceFiles: ['src/alpha.ts', 'src/beta.ts', 'src/alpha.unit.test.ts'],
		standardsPacks: [],
		packagesDir: 'packages',
		options,
		cache: new Map<string, string>(),
		compiler,
	});

const buildWithLowAndHighThreshold = async ({ kind, cwd }: { kind: StandardsInputKind; cwd: string }) => ({
	kind,
	low: await buildInputWithOptions({ kind, cwd, options: { minTokens: 20 } }),
	high: await buildInputWithOptions({ kind, cwd, options: { minTokens: 5000 } }),
});

const spanFilesOf = ({ input }: { input: StandardsCheckInput }) =>
	input.kind === StandardsInputKind.CloneSpans ? input.spans.map((span) => span.files.map((file) => file.path).sort()) : [];

describe('buildCheckInput', () => {
	test('builds the shape the declared kind names, for every kind in the closed set', async () => {
		const { cwd } = setupRepo();

		for (const kind of Object.values(StandardsInputKind)) {
			expect((await buildInput({ kind, cwd })).kind).toBe(kind);
		}
	});

	test('refuses a syntax-tree input when no typescript resolved, naming the kind', async () => {
		const { cwd } = setupRepo();

		const error = await getRejectionError({ promise: buildInput({ kind: StandardsInputKind.SyntaxTree, cwd, withCompiler: false }) });

		expect(error.message).toContain('syntax-tree');
		expect(error.message).toContain('typescript');
	});

	test('refuses an import-graph input when no typescript resolved', async () => {
		const { cwd } = setupRepo();

		const error = await getRejectionError({ promise: buildInput({ kind: StandardsInputKind.ImportGraph, cwd, withCompiler: false }) });

		expect(error.message).toContain('import-graph');
	});

	test('forwards options only to the clone-spans detector', async () => {
		const { cwd } = setupDuplicateRepo();
		const kinds = [
			StandardsInputKind.CloneSpans,
			StandardsInputKind.FileList,
			StandardsInputKind.FileText,
			StandardsInputKind.TestFile,
			StandardsInputKind.ImportGraph,
		];

		const built = await Promise.all(kinds.map((kind) => buildWithLowAndHighThreshold({ kind, cwd })));

		expect(
			built.map(({ kind, low, high }) => ({
				kind,
				lowThresholdSpans: spanFilesOf({ input: low }),
				highThresholdSpans: spanFilesOf({ input: high }),
				unchanged: isDeepStrictEqual(low, high),
			})),
		).toEqual([
			{
				kind: StandardsInputKind.CloneSpans,
				lowThresholdSpans: expect.arrayContaining([['src/alpha.ts', 'src/beta.ts']]),
				highThresholdSpans: [],
				unchanged: false,
			},
			{ kind: StandardsInputKind.FileList, lowThresholdSpans: [], highThresholdSpans: [], unchanged: true },
			{ kind: StandardsInputKind.FileText, lowThresholdSpans: [], highThresholdSpans: [], unchanged: true },
			{ kind: StandardsInputKind.TestFile, lowThresholdSpans: [], highThresholdSpans: [], unchanged: true },
			{ kind: StandardsInputKind.ImportGraph, lowThresholdSpans: [], highThresholdSpans: [], unchanged: true },
		]);
	});
});
