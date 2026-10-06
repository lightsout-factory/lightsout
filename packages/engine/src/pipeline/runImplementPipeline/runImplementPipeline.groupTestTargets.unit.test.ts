import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@jest/globals';
import { readConfig } from '#src/common/config/readConfig.ts';
import type { Driver } from '#src/common/types/Driver.ts';
import { runImplementPipeline } from '#src/pipeline/runImplementPipeline/runImplementPipeline.ts';
import { expectDefined } from '#tests/helpers/expectDefined.ts';
import { linkTypescript } from '#tests/helpers/linkTypescript.ts';
import { report } from '#tests/helpers/report.ts';
import { reviewReport } from '#tests/helpers/reviewReport.ts';
import { roleOf } from '#tests/helpers/roleOf.ts';
import { reachabilityRulesOff, setupConsumerRepo } from '#tests/helpers/setupConsumerRepo.ts';
import { withTestChangeReview } from '#tests/helpers/withTestChangeReview.ts';

test('write-tests fan-out: files that import each other share ONE writer; unrelated files stay parallel', async () => {
	const dir = setupConsumerRepo({ config: reachabilityRulesOff });

	linkTypescript({ dir });

	const writerPrompts: string[] = [];

	const driver: Driver = {
		name: 'stub',
		invoke: withTestChangeReview({
			invoke: async ({ prompt }) => {
				const role = roleOf(prompt);

				if (role === 'standards-review') {
					return { text: reviewReport(), exitCode: 0 };
				}

				if (role === 'write-tests') {
					writerPrompts.push(prompt);

					const testFile = `test/writer-${writerPrompts.length}.test.js`;

					mkdirSync(join(dir, 'test'), { recursive: true });
					writeFileSync(join(dir, testFile), '// stub\n');

					return { text: report({ changedFiles: [{ path: testFile, summary: 'tests' }] }), exitCode: 0 };
				}

				if (role === 'refactor') {
					return { text: report(), exitCode: 0 };
				}

				// Implement: a boundary importing an internal, plus one unrelated file.
				writeFileSync(join(dir, 'src/helper.ts'), 'export const helper = (n: number): number => n + 1;\n');
				writeFileSync(join(dir, 'src/feature.ts'), `import { helper } from './helper';\n\nexport const feature = (n: number): number => helper(n) * 2;\n`);
				writeFileSync(join(dir, 'src/other.ts'), 'export const other = (): number => 3;\n');

				return {
					text: report({
						changedFiles: [
							{ path: 'src/feature.ts', summary: 'boundary' },
							{ path: 'src/helper.ts', summary: 'internal' },
							{ path: 'src/other.ts', summary: 'unrelated' },
						],
					}),
					exitCode: 0,
				};
			},
		}),
	};

	const progress: string[] = [];
	const result = await runImplementPipeline({
		cwd: dir,
		driver,
		config: await readConfig({ cwd: dir }),
		loadedConfig: { config: await readConfig({ cwd: dir }) },
		planPath: 'plan.md',
		onProgress: (message) => progress.push(message),
	});

	expect(result.ok).toBe(true);
	// two import components — two writers, not three
	expect(writerPrompts.length).toBe(2);

	const grouped = writerPrompts.find((prompt) => prompt.includes('src/feature.ts'));
	const solo = writerPrompts.find((prompt) => prompt.includes('src/other.ts'));

	// the caller and the file it imports share one writer, listed together
	expect(grouped?.includes('# Changed files your tests must execute\n\n- src/feature.ts\n- src/helper.ts')).toBeTruthy();
	// unrelated file gets its own writer
	expectDefined(solo);
	expect(solo.includes('src/feature.ts')).toBeFalsy();
	expect(solo.includes('src/helper.ts')).toBeFalsy();
	// grouping narrated — got:\n${progress.join('\n')}
	expect(progress.some((line) => line.includes('2 group(s) covering 3 changed file(s)'))).toBeTruthy();
});

test('write-tests fan-out: two changed files imported by one UNCHANGED caller share one writer, and the caller is not assigned', async () => {
	const dir = setupConsumerRepo({ config: reachabilityRulesOff });

	linkTypescript({ dir });

	// The module pre-exists the run: pub.ts calls both parts — the run will
	// change ONLY the parts.
	mkdirSync(join(dir, 'src/mod/parts'), { recursive: true });
	writeFileSync(join(dir, 'src/mod/pub.ts'), "import { a } from './parts/a';\nimport { b } from './parts/b';\n\nexport const pub = (): number => a() + b();\n");
	writeFileSync(join(dir, 'src/mod/parts/a.ts'), 'export const a = (): number => 1;\n');
	writeFileSync(join(dir, 'src/mod/parts/b.ts'), 'export const b = (): number => 2;\n');
	execSync('git add -A && git -c user.name=t -c user.email=t@t commit -qm module', { cwd: dir });

	const writerPrompts: string[] = [];

	const driver: Driver = {
		name: 'stub',
		invoke: withTestChangeReview({
			invoke: async ({ prompt }) => {
				const role = roleOf(prompt);

				if (role === 'standards-review') {
					return { text: reviewReport(), exitCode: 0 };
				}

				if (role === 'write-tests') {
					writerPrompts.push(prompt);

					const testFile = `test/writer-${writerPrompts.length}.test.js`;

					mkdirSync(join(dir, 'test'), { recursive: true });
					writeFileSync(join(dir, testFile), '// stub\n');

					return { text: report({ changedFiles: [{ path: testFile, summary: 'tests' }] }), exitCode: 0 };
				}

				if (role === 'refactor') {
					return { text: report(), exitCode: 0 };
				}

				// Implement: both parts change; pub.ts does not.
				writeFileSync(join(dir, 'src/mod/parts/a.ts'), 'export const a = (): number => 10;\n');
				writeFileSync(join(dir, 'src/mod/parts/b.ts'), 'export const b = (): number => 20;\n');

				return {
					text: report({
						changedFiles: [
							{ path: 'src/mod/parts/a.ts', summary: 'part' },
							{ path: 'src/mod/parts/b.ts', summary: 'part' },
						],
					}),
					exitCode: 0,
				};
			},
		}),
	};

	const progress: string[] = [];
	const result = await runImplementPipeline({
		cwd: dir,
		driver,
		config: await readConfig({ cwd: dir }),
		loadedConfig: { config: await readConfig({ cwd: dir }) },
		planPath: 'plan.md',
		onProgress: (message) => progress.push(message),
	});

	expect(result.ok).toBe(true);
	// no import edge joins a.ts and b.ts — the caller they share alone makes them
	// one writer, so two writers never edit the caller's tests at once
	expect(writerPrompts.length).toBe(1);
	// only the changed files are assigned; which file a test goes through is the standards' call
	expect(writerPrompts[0]?.includes('# Changed files your tests must execute\n\n- src/mod/parts/a.ts\n- src/mod/parts/b.ts\n\n')).toBeTruthy();
	expect(writerPrompts[0]?.includes('src/mod/pub.ts')).toBeFalsy();
	// got:\n${progress.join('\n')}
	expect(progress.some((line) => line.includes('1 group(s) covering 2 changed file(s)'))).toBeTruthy();
});

test('write-tests fan-out: an importer with no runtime code of its own joins nothing — a re-exporting entry keeps its files on separate writers', async () => {
	const dir = setupConsumerRepo({ config: reachabilityRulesOff });

	linkTypescript({ dir });

	// The entry only re-exports: no test executes code through it, so it is no
	// shared caller, and the two files it publishes stay independent.
	mkdirSync(join(dir, 'src/lib'), { recursive: true });
	writeFileSync(join(dir, 'src/lib/index.ts'), "export { a } from './a';\nexport { b } from './b';\n");
	writeFileSync(join(dir, 'src/lib/a.ts'), 'export const a = (): number => 1;\n');
	writeFileSync(join(dir, 'src/lib/b.ts'), 'export const b = (): number => 2;\n');
	execSync('git add -A && git -c user.name=t -c user.email=t@t commit -qm lib', { cwd: dir });

	const writerPrompts: string[] = [];

	const driver: Driver = {
		name: 'stub',
		invoke: withTestChangeReview({
			invoke: async ({ prompt }) => {
				const role = roleOf(prompt);

				if (role === 'standards-review') {
					return { text: reviewReport(), exitCode: 0 };
				}

				if (role === 'write-tests') {
					writerPrompts.push(prompt);

					const testFile = `test/writer-${writerPrompts.length}.test.js`;

					mkdirSync(join(dir, 'test'), { recursive: true });
					writeFileSync(join(dir, testFile), '// stub\n');

					return { text: report({ changedFiles: [{ path: testFile, summary: 'tests' }] }), exitCode: 0 };
				}

				if (role === 'refactor') {
					return { text: report(), exitCode: 0 };
				}

				// Implement: both re-exported files change; the entry does not.
				writeFileSync(join(dir, 'src/lib/a.ts'), 'export const a = (): number => 10;\n');
				writeFileSync(join(dir, 'src/lib/b.ts'), 'export const b = (): number => 20;\n');

				return {
					text: report({
						changedFiles: [
							{ path: 'src/lib/a.ts', summary: 'part' },
							{ path: 'src/lib/b.ts', summary: 'part' },
						],
					}),
					exitCode: 0,
				};
			},
		}),
	};

	const result = await runImplementPipeline({
		cwd: dir,
		driver,
		config: await readConfig({ cwd: dir }),
		loadedConfig: { config: await readConfig({ cwd: dir }) },
		planPath: 'plan.md',
	});

	expect(result.ok).toBe(true);
	expect(writerPrompts.length).toBe(2);
});

// An import component larger than the writer cap would hand one agent a
// pathological amount of context. It is split into sorted chunks instead, and
// the split is narrated so the run explains why one concept got two writers.
test('write-tests fan-out: an import component above the writer cap splits into chunks, and says so', async () => {
	const dir = setupConsumerRepo({ config: reachabilityRulesOff });

	linkTypescript({ dir });

	const writerPrompts: string[] = [];
	const chainLength = 14;

	const driver: Driver = {
		name: 'stub',
		invoke: withTestChangeReview({
			invoke: async ({ prompt }) => {
				const role = roleOf(prompt);

				if (role === 'standards-review') {
					return { text: reviewReport(), exitCode: 0 };
				}

				if (role === 'write-tests') {
					writerPrompts.push(prompt);

					const testFile = `test/writer-${writerPrompts.length}.test.js`;

					mkdirSync(join(dir, 'test'), { recursive: true });
					writeFileSync(join(dir, testFile), '// stub\n');

					return { text: report({ changedFiles: [{ path: testFile, summary: 'tests' }] }), exitCode: 0 };
				}

				if (role === 'refactor') {
					return { text: report(), exitCode: 0 };
				}

				// One chain: every file imports the next, so they form a single
				// connected component longer than the cap.
				const changedFiles = [];

				for (let index = 0; index < chainLength; index += 1) {
					const next = index + 1 < chainLength ? `import { link${index + 1} } from './link${index + 1}';\n` : '';
					const body = `export const link${index} = (): number => ${index + 1 < chainLength ? `link${index + 1}()` : index};\n`;

					writeFileSync(join(dir, `src/link${index}.ts`), `${next}\n${body}`);
					changedFiles.push({ path: `src/link${index}.ts`, summary: 'chain' });
				}

				return { text: report({ changedFiles }), exitCode: 0 };
			},
		}),
	};

	const progress: string[] = [];
	const result = await runImplementPipeline({
		cwd: dir,
		driver,
		config: await readConfig({ cwd: dir }),
		loadedConfig: { config: await readConfig({ cwd: dir }) },
		planPath: 'plan.md',
		onProgress: (message) => progress.push(message),
	});

	expect(result.ok).toBe(true);

	const splitLine = progress.find((line) => line.includes('exceeds the'));

	expectDefined(splitLine);
	expect(splitLine).toMatch(/import component of 14 files exceeds the 12-file writer cap/);
	// one oversized component becomes more than one writer
	expect(writerPrompts.length).toBeGreaterThan(1);
});
