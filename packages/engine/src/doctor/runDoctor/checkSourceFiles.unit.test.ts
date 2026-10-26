import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { checkSourceFiles } from '#src/doctor/runDoctor/checkSourceFiles.ts';

const setupRepo = ({ files, sourceFiles, testFiles = ['**/*.test.*'] }: { files: string[]; sourceFiles: string[]; testFiles?: string[] }) => {
	const cwd = mkdtempSync(join(tmpdir(), 'lightsout-source-files-'));

	for (const name of files) {
		mkdirSync(join(cwd, dirname(name)), { recursive: true });
		writeFileSync(join(cwd, name), 'export const one = 1;\n');
	}

	const config = LightsoutConfig.parse({
		gates: { check: 'true', test: 'true', 'test-coverage': false },
		'source-files': sourceFiles,
		'test-files': testFiles,
	});

	return { cwd, config };
};

describe('checkSourceFiles', () => {
	test('passes, counting the code files and how many of them are tests', async () => {
		const { cwd, config } = setupRepo({ files: ['src/a.ts', 'src/a.test.ts', 'src/b.ts'], sourceFiles: ['src/**/*.ts'] });

		expect(await checkSourceFiles({ cwd, config })).toStrictEqual({ id: 'source-files', status: 'pass', detail: '3 code file(s), 1 of them tests' });
	});

	test('warns when source-files matches no file, since every check and writer would silently read nothing', async () => {
		const { cwd, config } = setupRepo({ files: ['src/a.ts'], sourceFiles: ['lib/**/*.ts'] });

		const check = await checkSourceFiles({ cwd, config });

		expect({ status: check.status, detail: check.detail, hasFix: check.fix !== undefined }).toStrictEqual({
			status: 'warn',
			detail: 'source-files matches no file in this repo, so no check, test writer or plan count has anything to read',
			hasFix: true,
		});
	});

	test('notes a glob that matches nothing, which is usually a typo, while the rest still count', async () => {
		const { cwd, config } = setupRepo({ files: ['src/a.ts'], sourceFiles: ['src/**/*.ts', 'scr/**/*.tsx', '!**/*.d.ts'] });

		const check = await checkSourceFiles({ cwd, config });

		// a ! glob excludes, so matching nothing is not a mistake in it
		expect({ status: check.status, detail: check.detail }).toStrictEqual({
			status: 'note',
			detail: '1 code file(s), 0 of them tests; "scr/**/*.tsx" match(es) no file',
		});
	});
});
