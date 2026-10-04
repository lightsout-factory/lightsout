import { execSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readConfig } from '#src/common/config/readConfig.ts';
import { readGateLog } from '#tests/helpers/readGateLog.ts';
import { runDirFor } from '#tests/helpers/runDirFor.ts';
import { seedRunFolder } from '#tests/helpers/seedRunFolder.ts';
import { selfCheckGateBlocks } from '#tests/helpers/selfCheckGateBlocks.ts';

interface Params {
	/** The root `gates` block this repo configures. */
	gates?: Record<string, string | false>;
	/** The scoped `package-gates` block, or null for a repo that configures no scoped block at all. */
	packageGates?: Record<string, string> | null;
	/** A `gate-overrides` block, keyed by checkpoint. */
	overrides?: Record<string, unknown>;
	/** The `scripts` every package's package.json declares — `{}` makes every `run <script>` template a skip. */
	scripts?: Record<string, string>;
	/** Files dirtied AFTER the initial commit — this is the live diff the scope is read from. */
	changed?: string[];
	/** false removes the worktree, which is how `git status` becomes unreadable. */
	git?: boolean;
}

/**
 * A two-package monorepo whose gate commands log what ran, committed clean and
 * then dirtied — so the live git diff at call time is exactly `changed`.
 * gates.log is ignored so a gate's own writing never reads back as a
 * root-level change.
 */
export const setupSelfCheck = async ({
	gates = selfCheckGateBlocks.gates,
	packageGates = selfCheckGateBlocks.packageGates,
	overrides,
	scripts,
	changed = ['packages/api/src/added.js'],
	git = true,
}: Params = {}) => {
	const dir = mkdtempSync(join(tmpdir(), 'lightsout-self-check-'));

	for (const packageDir of ['api', 'web']) {
		mkdirSync(join(dir, 'packages', packageDir, 'src'), { recursive: true });
		writeFileSync(join(dir, 'packages', packageDir, 'package.json'), JSON.stringify({ name: `@acme/${packageDir}`, ...(scripts ? { scripts } : {}) }));
		writeFileSync(join(dir, 'packages', packageDir, 'src', 'index.js'), 'export const one = 1;\n');
	}

	writeFileSync(join(dir, '.gitignore'), 'gates.log\n');
	writeFileSync(
		join(dir, 'lightsout.config.json'),
		JSON.stringify({
			gates,
			...(packageGates === null ? {} : { 'package-gates': packageGates }),
			...(overrides === undefined ? {} : { 'gate-overrides': overrides }),
		}),
	);
	execSync('git init -q && git config user.name t && git config user.email t@t && git add -A && git -c user.name=t -c user.email=t@t commit -qm init', {
		cwd: dir,
	});

	for (const file of changed) {
		writeFileSync(join(dir, file), 'export const written = 1;\n');
	}

	if (!git) {
		rmSync(join(dir, '.git'), { recursive: true, force: true });
	}

	// Every run below already has its folder, because `createRun` makes one
	// before a run starts and the evidence paths look the run up by id.
	for (const runId of ['run-1', 'run-evidence']) {
		seedRunFolder({ cwd: dir, runId });
	}

	return {
		dir,
		config: await readConfig({ cwd: dir }),
		log: () => readGateLog({ dir }),
		records: ({ runId }: { runId: string }): Record<string, unknown>[] =>
			readFileSync(join(runDirFor({ cwd: dir, runId }), 'commands.jsonl'), 'utf8')
				.trim()
				.split('\n')
				.map((line) => JSON.parse(line)),
	};
};
