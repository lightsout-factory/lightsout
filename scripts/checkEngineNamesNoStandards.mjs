import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, sep } from 'node:path';
import { invokedDirectly } from './invokedDirectly.mjs';
import { repoRoot } from './shipRelease/repoRoot.mjs';

const libraryDir = join(repoRoot, 'packages', 'lightsout-standards');
const engineSourceDir = join(repoRoot, 'packages', 'engine', 'src');

const filesUnder = ({ dir }) =>
	readdirSync(dir, { recursive: true })
		.map((entry) => entry.split(sep).join('/'))
		.filter((entry) => !entry.split('/').includes('node_modules') && statSync(join(dir, entry)).isFile());

const escapeRegExp = ({ text }) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The built-in library's names: each rule by its folder name less the number,
 * and each pack and topic by its address. A pack name alone is an ordinary
 * word (`react`, `standards`), so packs and topics are matched as addresses.
 */
const readBuiltInNames = () => {
	const ruleFolders = filesUnder({ dir: join(libraryDir, 'rules') }).filter((path) => basename(path) === 'rule.md');
	const rules = ruleFolders.map((path) => path.split('/').at(-2).replace(/^\d+-/, ''));
	const packs = readdirSync(join(libraryDir, 'packs')).map((file) => `lightsout/${file.replace(/\.json$/, '')}`);
	const topicRoots = readdirSync(join(libraryDir, 'rules')).map((root) => `lightsout/${root}/`);

	return { rules: [...new Set(rules)], addresses: [...packs, ...topicRoots] };
};

/**
 * Engine source never names a rule or a pack of the built-in library: the
 * engine is a runtime for any library, and a name in its code is a convention
 * it has quietly adopted. Tests may name them; they exercise real libraries.
 *
 * @returns one `path:line: name` entry per offending line, empty when clean
 */
export const findStandardsNames = () => {
	const { rules, addresses } = readBuiltInNames();
	const pattern = new RegExp(
		[
			...rules.map((rule) => `(?<![\\w-])${escapeRegExp({ text: rule })}(?![\\w-])`),
			...addresses.map((address) => `(?<![@\\w-])${escapeRegExp({ text: address })}(?![\\w-])`),
		].join('|'),
	);
	const sources = filesUnder({ dir: engineSourceDir }).filter((path) => !/\.test\.[^/]+$/.test(path));
	const offences = [];

	for (const path of sources) {
		readFileSync(join(engineSourceDir, path), 'utf8')
			.split('\n')
			.forEach((line, index) => {
				const match = line.match(pattern);

				if (match !== null) {
					offences.push(`packages/engine/src/${path}:${index + 1}: ${match[0]}`);
				}
			});
	}

	return offences;
};

if (invokedDirectly({ moduleUrl: import.meta.url })) {
	const offences = findStandardsNames();

	if (offences.length > 0) {
		console.error(`engine source names the built-in standards library (LO-199) — say what the engine knows instead:\n${offences.join('\n')}`);
		process.exit(1);
	}
}
