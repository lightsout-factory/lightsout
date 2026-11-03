import { execSync } from 'node:child_process';
import { mkdtempSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@jest/globals';
import { resolveConfigAndDriver } from '#src/cli/common/resolveConfigAndDriver.ts';
import { setupBranchRepo } from '#tests/helpers/setupBranchRepo.ts';
import { sourceFileGlobs } from '#tests/helpers/sourceFileGlobs.ts';
import { testFileGlobs } from '#tests/helpers/testFileGlobs.ts';

const setupConsumerDir = ({ config }: { config?: Record<string, unknown> } = {}) => {
	const cwd = mkdtempSync(join(tmpdir(), 'lightsout-cli-resolve-'));

	if (config) {
		writeFileSync(join(cwd, 'lightsout.config.json'), JSON.stringify(config));
	}

	return { cwd };
};

/**
 * The shape that billed the wrong harness: a primary checkout whose config is
 * gitignored, so it is never committed, and a linked worktree cut from it that
 * therefore holds no config at all.
 */
const setupIgnoredConfigWorktree = ({ config }: { config: Record<string, unknown> }) => {
	const cwd = realpathSync(setupBranchRepo().cwd);
	const worktree = join(`${cwd}-worktrees`, 'lo-10-read-config-outside-worktree');

	writeFileSync(join(cwd, '.gitignore'), 'lightsout.config.json\n');
	writeFileSync(join(cwd, 'lightsout.config.json'), JSON.stringify(config));
	execSync(`git worktree add -q -b lo-10-read-config-outside-worktree "${worktree}" main`, { cwd, stdio: 'ignore' });

	return { cwd, worktree };
};

test('resolveConfigAndDriver: a worktree cut from a checkout whose config is gitignored still runs on that config’s harness and model', async () => {
	const { cwd, worktree } = setupIgnoredConfigWorktree({
		config: {
			harness: 'omp',
			model: 'glm-5.3-flash',
			'source-files': sourceFileGlobs,
			'test-files': testFileGlobs,
			gates: { check: 'c', test: 't', 'test-coverage': false },
		},
	});

	const { config, driver, configPath } = await resolveConfigAndDriver({ cwd: worktree, command: 'plan' });

	// the tree has no file of its own, so the primary checkout's is the one
	// read — never the default harness on its default model
	expect({ driver: driver.name, model: config?.model, configPath }).toStrictEqual({
		driver: 'omp',
		model: 'glm-5.3-flash',
		configPath: join(cwd, 'lightsout.config.json'),
	});
});

test('resolveConfigAndDriver: only a genuinely absent config file is non-fatal — claude-code driver, no config', async () => {
	const { cwd } = setupConsumerDir();

	const { config, driver, configPath } = await resolveConfigAndDriver({ cwd, command: 'improve' });

	expect(config).toBe(undefined);
	expect(driver.name).toBe('claude-code');
	// no file was read, so there is no path to report
	expect(configPath).toBe(undefined);
});

test('resolveConfigAndDriver: global harness and model land in the effective config and the driver', async () => {
	const { cwd } = setupConsumerDir({
		config: {
			harness: 'codex',
			model: 'gpt-5.2',
			'source-files': sourceFileGlobs,
			'test-files': testFileGlobs,
			gates: { check: 'c', test: 't', 'test-coverage': false },
		},
	});

	const { config, driver, configPath } = await resolveConfigAndDriver({ cwd, command: 'plan' });

	expect(driver.name).toBe('codex');
	expect(config).toStrictEqual({
		harness: 'codex',
		model: 'gpt-5.2',
		effort: undefined,
		'source-files': sourceFileGlobs,
		'test-files': testFileGlobs,
		gates: { check: 'c', test: 't', 'test-coverage': false },
	});
	expect(configPath).toBe(join(cwd, 'lightsout.config.json'));
});

test('resolveConfigAndDriver: a per-command harness override drops the global model from the effective config (decision 7)', async () => {
	const { cwd } = setupConsumerDir({
		config: {
			model: 'opus',
			commands: { improve: { harness: 'codex' } },
			'source-files': sourceFileGlobs,
			'test-files': testFileGlobs,
			gates: { check: 'c', test: 't', 'test-coverage': false },
		},
	});

	const { config, driver } = await resolveConfigAndDriver({ cwd, command: 'improve' });

	expect(driver.name).toBe('codex');
	expect(config).toStrictEqual({
		harness: 'codex',
		model: undefined,
		effort: undefined,
		commands: { improve: { harness: 'codex' } },
		'source-files': sourceFileGlobs,
		'test-files': testFileGlobs,
		gates: { check: 'c', test: 't', 'test-coverage': false },
	});
});

test('resolveConfigAndDriver: a global effort lands in the effective config', async () => {
	const { cwd } = setupConsumerDir({
		config: { effort: 'high', 'source-files': sourceFileGlobs, 'test-files': testFileGlobs, gates: { check: 'c', test: 't', 'test-coverage': false } },
	});

	const { config } = await resolveConfigAndDriver({ cwd, command: 'plan' });

	expect(config).toStrictEqual({
		harness: 'claude-code',
		model: undefined,
		effort: 'high',
		'source-files': sourceFileGlobs,
		'test-files': testFileGlobs,
		gates: { check: 'c', test: 't', 'test-coverage': false },
	});
});

test('resolveConfigAndDriver: a per-command effort overrides the global in the effective config', async () => {
	const { cwd } = setupConsumerDir({
		config: {
			effort: 'low',
			commands: { plan: { effort: 'max' } },
			'source-files': sourceFileGlobs,
			'test-files': testFileGlobs,
			gates: { check: 'c', test: 't', 'test-coverage': false },
		},
	});

	const { config } = await resolveConfigAndDriver({ cwd, command: 'plan' });

	expect(config).toStrictEqual({
		harness: 'claude-code',
		model: undefined,
		effort: 'max',
		commands: { plan: { effort: 'max' } },
		'source-files': sourceFileGlobs,
		'test-files': testFileGlobs,
		gates: { check: 'c', test: 't', 'test-coverage': false },
	});
});

test('resolveConfigAndDriver: a present-but-invalid config (typoed commands key) is a hard error', async () => {
	const { cwd } = setupConsumerDir({
		config: {
			commands: { implment: {} },
			'source-files': sourceFileGlobs,
			'test-files': testFileGlobs,
			gates: { check: 'c', test: 't', 'test-coverage': false },
		},
	});

	// continuing would silently discard every setting in the file and run with
	// defaults (decision 26)
	expect(resolveConfigAndDriver({ cwd, command: 'implement' })).rejects.toThrow();
});
