import { describe, expect, test } from '@jest/globals';
import type { FileTextInput } from '@lightsout/standards-contracts';
import { StandardsInputKind } from '@lightsout/standards-contracts';
import { readFileTexts } from './readFileTexts.ts';

/** The file-text input as the engine builds it: what is in scope, what may reference it, and the text of both. */
const setupFileTextInput = ({
	files = ['src/feature/getLabel.ts', 'src/feature/getLabel.unit.test.ts'],
	tests = ['src/feature/getLabel.unit.test.ts'],
	referenceFiles = ['src/app/runApp.ts'],
	contents = [
		['src/feature/getLabel.ts', 'export const getLabel = () => "label";'],
		['src/feature/getLabel.unit.test.ts', 'describe("getLabel", () => {});'],
		['src/app/runApp.ts', 'import { getLabel } from "../feature/getLabel";'],
	] as Array<[string, string]>,
	standardsLibraries = [],
}: {
	files?: string[];
	tests?: string[];
	referenceFiles?: string[];
	contents?: Array<[string, string]>;
	standardsLibraries?: string[];
} = {}): FileTextInput => ({
	kind: StandardsInputKind.FileText,
	cwd: '/repo',
	source: files,
	tests,
	files,
	referenceFiles,
	contents: new Map(contents),
	standardsLibraries,
});

describe('readFileTexts', () => {
	test('hands back the scope, the tests within it, the reference files and the text of every one', () => {
		const input = setupFileTextInput();

		const texts = readFileTexts({ input });

		expect(texts).toStrictEqual({
			files: ['src/feature/getLabel.ts', 'src/feature/getLabel.unit.test.ts'],
			tests: ['src/feature/getLabel.unit.test.ts'],
			referenceFiles: ['src/app/runApp.ts'],
			contents: new Map([
				['src/feature/getLabel.ts', 'export const getLabel = () => "label";'],
				['src/feature/getLabel.unit.test.ts', 'describe("getLabel", () => {});'],
				['src/app/runApp.ts', 'import { getLabel } from "../feature/getLabel";'],
			]),
			standardsLibraries: [],
		});
	});

	test('an empty scope reads back as empty rather than as missing', () => {
		const input = setupFileTextInput({ files: [], tests: [], referenceFiles: [], contents: [] });

		const texts = readFileTexts({ input });

		expect(texts).toStrictEqual({ files: [], tests: [], referenceFiles: [], contents: new Map(), standardsLibraries: [] });
	});

	test('carries the pack roots the input declares, rather than a fixed empty list', () => {
		const input = setupFileTextInput({ standardsLibraries: ['standards', 'vendor/acme-standards'] });

		const texts = readFileTexts({ input });

		expect(texts.standardsLibraries).toStrictEqual(['standards', 'vendor/acme-standards']);
	});

	test('a missing input yields an empty scope rather than refusing', () => {
		const texts = readFileTexts({ input: undefined });

		expect(texts).toStrictEqual({ files: [], tests: [], referenceFiles: [], contents: new Map(), standardsLibraries: [] });
	});
});
