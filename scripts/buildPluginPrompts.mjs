import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { invokedDirectly } from './invokedDirectly.mjs';

/**
 * Writes each plugin's slash-command routers from its skills, for the
 * pi-family harnesses only; `--check` fails when a committed directory differs.
 *
 * pi and omp offer no menu of plugin skills, so the routers are that menu.
 * Claude Code already lists every skill as a slash command, so a router there
 * would show each entry point twice.
 *
 * pi reads `prompts` from the `pi` block in package.json; omp treats a
 * marketplace install as a Claude Code plugin and reads the directory named by
 * `slash-commands` in `.claude-plugin/plugin.json`, a key Claude Code ignores.
 *
 * A router holds no workflow of its own, only a pointer to its skill, so the
 * two cannot drift. The marker lets write mode prune a router whose skill
 * disappeared.
 */

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

const pluginDirs = ['plugin', 'plugin-linear', 'plugin-jira'];
const marker = '<!-- generated:lightsout-prompt -->';
/** The value `slash-commands` must carry, or omp cannot find the routers. */
const promptsPath = './prompts';

/** Handles the plain single-line form and the folded (`>-`) block some skills use. */
const parseFrontmatter = ({ text }) => {
	const lines = text.split('\n');
	const end = lines.indexOf('---', 1);

	if (lines[0] !== '---' || end === -1) {
		return {};
	}

	const fields = {};
	let blockKey;

	for (const line of lines.slice(1, end)) {
		if (blockKey !== undefined && (line.startsWith('  ') || line.trim() === '')) {
			const piece = line.trim();

			if (piece !== '') {
				fields[blockKey] = fields[blockKey] === '' ? piece : `${fields[blockKey]} ${piece}`;
			}
			continue;
		}

		blockKey = undefined;

		const match = /^(name|description):(.*)$/.exec(line);

		if (match === null) {
			continue;
		}

		const value = match[2].trim();

		if (value === '>' || value === '>-' || value === '|' || value === '|-') {
			blockKey = match[1];
			fields[blockKey] = '';
		} else if (value !== '') {
			fields[match[1]] = value;
		}
	}

	return fields;
};

/** Single-quoted: the one YAML quoting form every consumer of these files accepts. */
const quoteScalar = ({ value }) => `'${value.replaceAll("'", "''")}'`;

const routerFor = ({ pluginName, skillName, description }) => `---
description: ${quoteScalar({ value: description })}
---
${marker}

Read \`skill://${skillName}\` — the ${pluginName} \`${skillName}\` skill — and follow it exactly as if the user had invoked it directly.

User input: $ARGUMENTS
`;

const buildRouters = ({ pluginDir }) => {
	const skillsDir = join(repoRoot, pluginDir, 'skills');
	const manifestPath = join(pluginDir, '.claude-plugin', 'plugin.json');
	const { name: pluginName, 'slash-commands': slashCommands } = JSON.parse(readFileSync(join(repoRoot, manifestPath), 'utf8'));
	const routers = new Map();

	if (slashCommands !== promptsPath) {
		throw new Error(
			`${manifestPath} must set "slash-commands" to "${promptsPath}" — that is how omp finds the routers; it has ${JSON.stringify(slashCommands)}.`,
		);
	}

	for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
		if (!entry.isDirectory()) {
			continue;
		}

		const skillPath = join(skillsDir, entry.name, 'SKILL.md');

		if (!existsSync(skillPath)) {
			continue;
		}

		const { name = entry.name, description = '' } = parseFrontmatter({ text: readFileSync(skillPath, 'utf8') });

		routers.set(name, routerFor({ pluginName, skillName: name, description }));
	}

	return { promptsDir: join(repoRoot, pluginDir, 'prompts'), pluginName, routers };
};

const onDiskRouterNames = ({ promptsDir }) => {
	if (!existsSync(promptsDir)) {
		return [];
	}

	return readdirSync(promptsDir)
		.filter((file) => file.endsWith('.md') && readFileSync(join(promptsDir, file), 'utf8').includes(marker))
		.map((file) => file.slice(0, -3));
};

/**
 * Exit codes are set rather than forced with `process.exit`: stdout is a pipe
 * for every caller that matters, and exiting right after a log discards it.
 */
const main = () => {
	const checking = process.argv.includes('--check');
	const plugins = pluginDirs.map((pluginDir) => buildRouters({ pluginDir }));

	try {
		for (const { promptsDir, pluginName, routers } of plugins) {
			if (!checking) {
				mkdirSync(promptsDir, { recursive: true });

				// only a generated router is ever pruned — a hand-added file is
				// none of this script's business
				for (const stale of onDiskRouterNames({ promptsDir })) {
					rmSync(join(promptsDir, `${stale}.md`));
				}

				for (const [name, text] of routers) {
					writeFileSync(join(promptsDir, `${name}.md`), text);
				}

				console.log(`wrote ${promptsDir.replace(`${repoRoot}/`, '')} (${routers.size} routers)`);

				continue;
			}

			const stale = onDiskRouterNames({ promptsDir });
			const mismatched = [...routers].some(([name, text]) => readFileSync(join(promptsDir, `${name}.md`), 'utf8') !== text);
			const missing = [...routers.keys()].some((name) => !stale.includes(name));

			if (mismatched || missing || stale.length !== routers.size) {
				console.error('');
				console.error(`  ${promptsDir.replace(`${repoRoot}/`, '')} no longer mirrors its skills.`);
				console.error(`  These are the slash commands pi and omp users meet for the ${pluginName} plugin.`);
				console.error('');
				console.error(`    pnpm build:plugin-prompts && git add ${pluginDirs.map((dir) => `${dir}/prompts`).join(' ')}`);
				console.error('');
				process.exitCode = 1;
				return;
			}

			console.log(`${promptsDir.replace(`${repoRoot}/`, '')} matches its skills (${routers.size} routers)`);
		}
	} catch (error) {
		console.error('');
		console.error(`  ${error instanceof Error ? error.message : String(error)}`);
		console.error('');
		process.exitCode = 1;
	}
};

if (invokedDirectly({ moduleUrl: import.meta.url })) {
	main();
}
