import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const capSources = [
	{ rule: 'code/style-guide/patterns/functions/30-file-size/rule.md', keys: { file: 'file', tsxFile: 'tsxFile' } },
	{ rule: 'code/style-guide/patterns/functions/25-function-size/rule.md', keys: { function: 'function' } },
	{ rule: 'tests/unit-testing/18-test-file-size/rule.md', keys: { testFile: 'testFile' } },
	{ rule: 'code/architecture/folder-structure/35-folder-size/rule.md', keys: { folderCensus: 'cap' } },
];

/**
 * A small line reader rather than a YAML dependency: the block is two levels
 * deep, always numeric, and the pack's own contract rather than user input.
 */
const readSettings = ({ path }) => {
	const lines = readFileSync(path, 'utf8').split('\n');
	const start = lines.findIndex((line) => line.trim() === 'settings:');

	if (start === -1) {
		throw new Error(`${path} has no settings: block — the caps the animation states have to be read from the pack, never typed in`);
	}

	const settings = {};

	for (const line of lines.slice(start + 1)) {
		const entry = /^\s+([A-Za-z][\w-]*):\s*(.+?)\s*$/.exec(line);

		if (entry === null) {
			break;
		}

		settings[entry[1]] = Number(entry[2]);
	}

	return settings;
};

/**
 * A missing rule file or key is a hard error: a page stating a cap must not
 * ship a plausible guess.
 */
export const readSprawlCaps = ({ repoRoot }) => {
	const packRoot = join(repoRoot, 'packages', 'standards-typescript');
	const caps = {};

	for (const { rule, keys } of capSources) {
		const settings = readSettings({ path: join(packRoot, rule) });

		for (const [cap, key] of Object.entries(keys)) {
			if (!Number.isFinite(settings[key])) {
				throw new Error(`${rule} has no numeric \`${key}\` setting`);
			}

			caps[cap] = settings[key];
		}
	}

	// Spelled out so the JSON's key order is fixed and a rebuild cannot reshuffle it.
	return { file: caps.file, tsxFile: caps.tsxFile, function: caps.function, testFile: caps.testFile, folderCensus: caps.folderCensus };
};
