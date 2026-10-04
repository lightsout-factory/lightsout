import { globSync, readFileSync } from 'node:fs';
import { dirname, join, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
import { invokedDirectly } from './invokedDirectly.mjs';

/**
 * A standards package ships as a bare directory with no `node_modules`, so a
 * few definitions must be duplicated rather than imported, and two copies
 * disagreeing is not a compile error — it is a rule quietly applying to the
 * wrong files.
 *
 * A copy declares its twin with `@mirrors <repo-relative path>`. Both are
 * re-printed WITHOUT comments before comparing, because each copy's prose is
 * written for its own reader and only the code has to match. A pair that must
 * agree in behaviour while differing in code is held by `behaviouralMirrors`
 * instead.
 */
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

const findDeclaredMirrors = () => {
	const pairs = [];

	for (const path of globSync('packages/*/**/*.ts', {
		cwd: repoRoot,
		exclude: (name) => name === 'node_modules' || name === 'coverage' || name === 'fixtures',
	})) {
		const twin = /@mirrors\s+(\S+)/.exec(readFileSync(join(repoRoot, path), 'utf8'))?.[1];

		if (twin !== undefined) {
			pairs.push([path.split(sep).join('/'), twin]);
		}
	}

	// Both copies name each other, so every pair turns up twice.
	return [...new Map(pairs.map((pair) => [[...pair].sort().join(' ↔ '), pair])).values()];
};

/**
 * The inputs stay inside the contract both copies document — `/`-separated or
 * a bare filename. A Windows separator would split them for a reason neither
 * promises to handle.
 */
const behaviouralMirrors = [
	{
		name: 'getExportName',
		left: 'packages/engine/src/plan/common/getExportName.ts',
		right: 'packages/lightsout-standards/common/naming/getExportName.ts',
		export: 'getExportName',
		inputs: [
			'index.ts',
			'src/plan/runPlanDraft.ts',
			'a/b/Component.tsx',
			'a/b/module.mjs',
			'a/b/module.cjs',
			'legacy/script.js',
			'legacy/View.jsx',
			'types/Config.d.ts',
			'name.with.dots.ts',
			'no-extension',
			'deep/nested/path/getExportName.ts',
			'.hidden.ts',
			'',
		].map((path) => ({ path })),
	},
];

const compareBehaviour = async ({ pair }) => {
	const [left, right] = await Promise.all([import(pathToFileURL(join(repoRoot, pair.left)).href), import(pathToFileURL(join(repoRoot, pair.right)).href)]);

	for (const input of pair.inputs) {
		const [leftAnswer, rightAnswer] = [left[pair.export](input), right[pair.export](input)];

		if (leftAnswer !== rightAnswer) {
			return `${pair.left} and ${pair.right} must agree, but for ${JSON.stringify(input)} they return ${JSON.stringify(leftAnswer)} and ${JSON.stringify(rightAnswer)}`;
		}
	}

	return undefined;
};

const codeOf = ({ path }) => {
	const text = readFileSync(join(repoRoot, path), 'utf8');
	const sourceFile = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);

	return ts.createPrinter({ removeComments: true }).printFile(sourceFile);
};

export const checkMirrors = async () => {
	const pairs = findDeclaredMirrors();
	const problems = [];

	for (const [copy, twin] of pairs) {
		try {
			if (codeOf({ path: copy }) !== codeOf({ path: twin })) {
				problems.push(`${copy} and ${twin} declare each other a mirror, but their code differs`);
			}
		} catch {
			problems.push(`${copy} names ${twin} as its mirror, and that file cannot be read`);
		}
	}

	for (const pair of behaviouralMirrors) {
		try {
			const difference = await compareBehaviour({ pair });

			if (difference !== undefined) {
				problems.push(difference);
			}
		} catch (error) {
			problems.push(`the ${pair.name} behavioural mirror could not be run — ${error.message}`);
		}
	}

	return { problems, compared: pairs.length, comparedByBehaviour: behaviouralMirrors.length };
};

const main = async () => {
	const { problems, compared, comparedByBehaviour } = await checkMirrors();

	if (problems.length === 0) {
		console.log(`${compared} declared mirror(s) and ${comparedByBehaviour} behavioural pair(s) agree`);

		return;
	}

	console.error('');

	for (const problem of problems) {
		console.error(`  ${problem}`);
	}

	console.error('');
	console.error('  These copies exist because a standards package cannot import from the engine.');
	console.error('  Reconcile them by hand — comments may differ, code may not.');
	console.error('');
	process.exitCode = 1;
};

if (invokedDirectly({ moduleUrl: import.meta.url })) {
	await main();
}
