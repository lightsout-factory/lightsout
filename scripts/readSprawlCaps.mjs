import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const capSources = [
	{ rule: 'rules/code/fractal/size/10-file-size/rule.md', keys: { file: 'file', tsxFile: 'tsxFile' } },
	{ rule: 'rules/code/fractal/size/05-function-size/rule.md', keys: { function: 'function' } },
	{ rule: 'rules/tests/fractal/15-test-file-size/rule.md', keys: { testFile: 'testFile' } },
	{ rule: 'rules/code/fractal/size/15-folder-size/rule.md', keys: { folderCensus: 'cap' } },
];

/**
 * A small line reader rather than a YAML dependency: the block is two levels
 * deep, always numeric, and the pack's own contract rather than user input.
 */
const readOptions = ({ path }) => {
	const lines = readFileSync(path, 'utf8').split('\n');
	const start = lines.findIndex((line) => line.trim() === 'options:');

	if (start === -1) {
		throw new Error(`${path} has no options: block — the caps the animation states have to be read from the pack, never typed in`);
	}

	const options = {};

	for (const line of lines.slice(start + 1)) {
		const entry = /^\s+([A-Za-z][\w-]*):\s*(.+?)\s*$/.exec(line);

		if (entry === null) {
			break;
		}

		options[entry[1]] = Number(entry[2]);
	}

	return options;
};

/**
 * A missing rule file or key is a hard error: a page stating a cap must not
 * ship a plausible guess.
 */
export const readSprawlCaps = ({ repoRoot }) => {
	const packRoot = join(repoRoot, 'packages', 'lightsout-standards');
	const caps = {};

	for (const { rule, keys } of capSources) {
		const options = readOptions({ path: join(packRoot, rule) });

		for (const [cap, key] of Object.entries(keys)) {
			if (!Number.isFinite(options[key])) {
				throw new Error(`${rule} has no numeric \`${key}\` option`);
			}

			caps[cap] = options[key];
		}
	}

	// Spelled out so the JSON's key order is fixed and a rebuild cannot reshuffle it.
	return { file: caps.file, tsxFile: caps.tsxFile, function: caps.function, testFile: caps.testFile, folderCensus: caps.folderCensus };
};
