import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';

const repoRoot = join(__dirname, '..', '..', '..');
const pluginDirs = ['plugin', 'plugin-linear', 'plugin-jira'];
const copiedScripts = ['buildPluginPrompts.mjs', 'invokedDirectly.mjs', 'messageOf.mjs', 'runScript.mjs'];

/**
 * A copy of the script in a tree of its own, since it reads the plugins beside it: three plugins,
 * each with one skill and a valid manifest, and the routers written once so a check starts green.
 */
const setupPlugins = async () => {
	const cwd = await mkdtemp(join(tmpdir(), 'lightsout-plugin-prompts-'));
	const scriptPath = join(cwd, 'scripts', 'buildPluginPrompts.mjs');

	await mkdir(join(cwd, 'scripts'), { recursive: true });

	for (const name of copiedScripts) {
		await writeFile(join(cwd, 'scripts', name), await readFile(join(repoRoot, 'scripts', name), 'utf8'));
	}

	for (const pluginDir of pluginDirs) {
		await mkdir(join(cwd, pluginDir, '.claude-plugin'), { recursive: true });
		await mkdir(join(cwd, pluginDir, 'skills', 'ticket'), { recursive: true });
		await writeFile(join(cwd, pluginDir, '.claude-plugin', 'plugin.json'), JSON.stringify({ name: pluginDir, 'slash-commands': './prompts' }));
		await writeFile(join(cwd, pluginDir, 'skills', 'ticket', 'SKILL.md'), '---\nname: ticket\ndescription: Work a ticket.\n---\n');
	}

	const run = ({ args = [] }: { args?: string[] } = {}) => {
		const ran = spawnSync('node', [scriptPath, ...args], { cwd, encoding: 'utf8' });

		return { status: ran.status, stderr: ran.stderr };
	};

	run();

	return { cwd, run };
};

describe('buildPluginPrompts --check', () => {
	test('passes on routers that mirror their skills', async () => {
		const { run } = await setupPlugins();

		expect(run({ args: ['--check'] }).status).toBe(0);
	});

	test('reports a wrong slash-commands value as a plain message with a non-zero exit', async () => {
		const { cwd, run } = await setupPlugins();

		await writeFile(join(cwd, 'plugin-linear', '.claude-plugin', 'plugin.json'), JSON.stringify({ name: 'plugin-linear', 'slash-commands': './commands' }));
		const checked = run({ args: ['--check'] });

		expect(checked.status).toBe(1);
		expect(checked.stderr).toContain('plugin-linear/.claude-plugin/plugin.json must set "slash-commands" to "./prompts"');
		expect(checked.stderr).not.toMatch(/^\s+at /m);
	});

	test('reports an unreadable plugin.json as a plain message naming it, with a non-zero exit', async () => {
		const { cwd, run } = await setupPlugins();

		await writeFile(join(cwd, 'plugin-jira', '.claude-plugin', 'plugin.json'), '{ "name": ');
		const checked = run({ args: ['--check'] });

		expect(checked.status).toBe(1);
		expect(checked.stderr).toContain('plugin-jira/.claude-plugin/plugin.json could not be read as JSON');
		expect(checked.stderr).not.toMatch(/^\s+at /m);
	});

	test('reports a missing router as a directory that no longer mirrors its skills', async () => {
		const { cwd, run } = await setupPlugins();

		await rm(join(cwd, 'plugin', 'prompts', 'ticket.md'));
		const checked = run({ args: ['--check'] });

		expect(checked.status).toBe(1);
		expect(checked.stderr).toContain('plugin/prompts no longer mirrors its skills');
	});
});
