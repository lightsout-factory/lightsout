import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { type FileListInput, type StandardsCheckFunction, type StandardsCheckInput, StandardsInputKind } from '@lightsout/standards-contracts';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import type { ResolvedRuleState } from '#src/standardsCheck/internal/common/types/ResolvedRuleState.ts';
import { runPackageChecks } from '#src/standardsCheck/runPackageChecks.ts';
import type { LoadedStandardsLibrary } from '#src/standardsLibraries/common/types/LoadedStandardsLibrary.ts';
import type { LoadedStandardsRule } from '#src/standardsLibraries/common/types/LoadedStandardsRule.ts';
import { linkTypescript } from '#tests/helpers/linkTypescript.ts';

// What the run borrows from the repo it checks: the typescript the compiler-backed
// rules need, and the workspace packages under the packages dir the repo configured.

/** A repo the checks run against. `typescript` decides whether the compiler-backed kinds can run at all. */
const setupRepo = ({ typescript = false }: { typescript?: boolean } = {}) => {
	const cwd = mkdtempSync(join(tmpdir(), 'lightsout-package-checks-'));

	mkdirSync(join(cwd, 'src/feature'), { recursive: true });
	writeFileSync(join(cwd, 'src/alpha.ts'), 'export const alpha = 1;\n');
	writeFileSync(join(cwd, 'src/feature/internal.ts'), 'export const internal = 2;\n');
	writeFileSync(join(cwd, 'src/alpha.unit.test.ts'), "test('alpha', () => {});\n");
	// A real repo has one, and without it the run rightly notes that it could not
	// know this repo's path aliases — a second note every unrelated case would
	// then have to carry.
	writeFileSync(join(cwd, 'tsconfig.json'), '{ "compilerOptions": { "strict": true } }\n');

	if (typescript) {
		mkdirSync(join(cwd, 'node_modules'), { recursive: true });
		symlinkSync(join(process.cwd(), 'node_modules/typescript'), join(cwd, 'node_modules/typescript'), 'dir');
	}

	return { cwd };
};

/** A repo whose workspace packages sit somewhere other than the `packages/` default — the config's `packagesDir`. */
const setupWorkspaceRepo = ({ typescript = false }: { typescript?: boolean } = {}) => {
	const cwd = mkdtempSync(join(tmpdir(), 'lightsout-package-checks-apps-'));

	mkdirSync(join(cwd, 'src'), { recursive: true });
	mkdirSync(join(cwd, 'apps/web'), { recursive: true });
	writeFileSync(join(cwd, 'src/alpha.ts'), 'export const alpha = 1;\n');
	writeFileSync(join(cwd, 'apps/web/package.json'), JSON.stringify({ dependencies: { react: '^19.0.0' } }));

	if (typescript) {
		// the only typescript in the repo, and it sits inside the workspace package
		linkTypescript({ dir: join(cwd, 'apps/web') });
	}

	return { cwd };
};

const rule = (overrides: Partial<LoadedStandardsRule> & { id: string }): LoadedStandardsRule => ({
	name: `acme/${overrides.id}`,
	library: 'acme',
	set: 'code',
	documentPath: 'code/style-guide/structure/module-api',
	summary: 'a rule',
	prose: 'the argument for the rule',
	channel: 'base',
	checked: overrides.run !== undefined,
	defaultSeverity: StandardsSeverity.Advisory,
	defaultOptions: {},
	fixturesPath: `/packages/acme/${overrides.id}/fixtures`,
	...overrides,
});

/** A check for the rule `id` that reports one finding and records what it was handed. */
const recordingRun = ({ id, calls }: { id: string; calls: Array<{ input: StandardsCheckInput; options: Record<string, number> }> }): StandardsCheckFunction => {
	return ({ input, options }) => {
		calls.push({ input, options });

		return [{ siteKey: `${id}:${input.kind}:one`, files: [{ path: 'src/alpha.ts' }], detail: 'one site' }];
	};
};

/** The first input a check was handed, narrowed to the kind whose path lists the test reads. */
const fileListInput = ({ calls }: { calls: Array<{ input: StandardsCheckInput }> }): FileListInput => {
	const input = calls[0]?.input;

	if (input?.kind !== StandardsInputKind.FileList) {
		throw new Error(`expected a file-list input, got ${String(input?.kind)}`);
	}

	return input;
};

/** Runs the given rules as one loaded package, at the severities their own declarations give them. */
const runChecks = ({ rules, cwd, packagesDir }: { rules: LoadedStandardsRule[]; cwd: string; packagesDir?: string }) => {
	const pkg: LoadedStandardsLibrary = { name: 'acme', formatVersion: 1, rootPath: '/packages/acme', documents: [], rules };
	const states = new Map<string, ResolvedRuleState>(
		rules.map((entry) => [entry.name, { severity: entry.defaultSeverity, options: entry.defaultOptions, fromConfig: false }]),
	);

	return runPackageChecks({ cwd, packs: [pkg], states, channels: [], packagesDir });
};

describe('runPackageChecks target repo', () => {
	test('skips the compiler-backed rules with one note naming them when no typescript resolves', async () => {
		const { cwd } = setupRepo();
		const calls: Array<{ input: StandardsCheckInput; options: Record<string, number> }> = [];

		const { findings, notes } = await runChecks({
			cwd,
			rules: [
				rule({ id: 'dead-export', inputKind: StandardsInputKind.SyntaxTree, run: recordingRun({ id: 'dead-export', calls }) }),
				rule({ id: 'module-boundary', inputKind: StandardsInputKind.ImportGraph, run: recordingRun({ id: 'module-boundary', calls }) }),
				rule({ id: 'multi-export', inputKind: StandardsInputKind.FileText, run: recordingRun({ id: 'multi-export', calls }) }),
			],
		});

		expect(notes).toStrictEqual(['acme/dead-export, acme/module-boundary skipped — no typescript resolvable from the target repo']);
		// the rules that need no compiler still run
		expect(findings.map((finding) => finding.rule)).toStrictEqual(['acme/multi-export']);
	});

	test('runs the compiler-backed rules when the repo has a typescript to borrow', async () => {
		const { cwd } = setupRepo({ typescript: true });
		const calls: Array<{ input: StandardsCheckInput; options: Record<string, number> }> = [];

		const { findings, notes } = await runChecks({
			cwd,
			rules: [rule({ id: 'dead-export', inputKind: StandardsInputKind.SyntaxTree, run: recordingRun({ id: 'dead-export', calls }) })],
		});

		expect(notes).toStrictEqual([]);
		expect(findings.map((finding) => finding.rule)).toStrictEqual(['acme/dead-export']);
	});

	test('reads each workspace manifest from the packages dir the repo configured', async () => {
		const { cwd } = setupWorkspaceRepo();
		const calls: Array<{ input: StandardsCheckInput; options: Record<string, number> }> = [];

		await runChecks({
			cwd,
			rules: [rule({ id: 'dependency-drift', inputKind: StandardsInputKind.FileList, run: recordingRun({ id: 'dependency-drift', calls }) })],
			packagesDir: 'apps',
		});

		// a rule asking "does this app use React?" gets an answer only if the
		// engine looked where the repo keeps its packages
		expect(fileListInput({ calls }).dependencies.get('apps/web')).toStrictEqual(['react']);
	});

	test('borrows a workspace package typescript from the configured packages dir', async () => {
		const { cwd } = setupWorkspaceRepo({ typescript: true });
		const calls: Array<{ input: StandardsCheckInput; options: Record<string, number> }> = [];

		const { findings, notes } = await runChecks({
			cwd,
			rules: [rule({ id: 'dead-export', inputKind: StandardsInputKind.SyntaxTree, run: recordingRun({ id: 'dead-export', calls }) })],
			packagesDir: 'apps',
		});

		// without the configured dir the compiler-backed tier would sit out every
		// run in a monorepo that hoists nothing to its root
		expect(notes).toStrictEqual([]);
		expect(findings.map((finding) => finding.rule)).toStrictEqual(['acme/dead-export']);
	});
});
