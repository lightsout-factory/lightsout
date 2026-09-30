import { findPathAliases } from '../imports/findPathAliases.ts';
import { resolveImport } from '../imports/resolveImport.ts';
import type { BarrelExport } from '../types/BarrelExport.ts';

// Anchored at a line start and allowed to run across lines, because a formatter
// wraps a long list of names over many lines.
const starStatement = /^export\s+\*\s+(?:as\s+[A-Za-z0-9_$]+\s+)?from\s+['"]([^'"]+)['"]/gm;
const namedStatement = /^export\s+(?:type\s+)?\{([^}]*)\}\s*from\s+['"]([^'"]+)['"]/gm;

const getPublicName = ({ part }: { part: string }) => {
	const withoutType = part
		.trim()
		.replace(/^type\s+/, '')
		.trim();

	return /\bas\s+([A-Za-z0-9_$]+)$/.exec(withoutType)?.[1] ?? withoutType;
};

interface Params {
	/** Repo-relative path of the barrel to read — its folder anchors relative specifiers, and its package supplies the aliases. */
	barrelPath: string;
	/** The run's file text, holding the barrel and every tsconfig.json in scope. */
	contents: Map<string, string>;
	/** Every file in scope — the universe specifiers resolve against. */
	files: Set<string>;
}

/**
 * Regex parsing is enough because a barrel is named re-exports plus the
 * occasional `export *`, never arbitrary TypeScript.
 *
 * A target that could not be resolved is reported as `unknown` rather than
 * dropped, so a caller can tell a barrel it read from a barrel it merely failed
 * to read.
 */
export const readBarrelExports = ({ barrelPath, contents, files }: Params): BarrelExport[] => {
	const aliases = findPathAliases({ path: barrelPath, contents });
	const exports: BarrelExport[] = [];

	const text = contents.get(barrelPath) ?? '';
	const statements: Array<{ star: boolean; specifier?: string; entries?: string; at: number }> = [];

	for (const match of text.matchAll(starStatement)) {
		statements.push({ star: true, specifier: match[1], at: match.index });
	}

	for (const match of text.matchAll(namedStatement)) {
		statements.push({ star: false, specifier: match[2], entries: match[1], at: match.index });
	}

	// Back into the order they were written, so a barrel's report reads down the file.
	statements.sort((left, right) => left.at - right.at);

	for (const { star, specifier, entries } of statements) {
		if (specifier === undefined) {
			continue;
		}

		const names =
			entries === undefined
				? []
				: entries
						.split(',')
						.map((part) => getPublicName({ part }))
						.filter((name) => name.length > 0);

		exports.push({ names, star, specifier, target: resolveImport({ from: barrelPath, specifier, files, aliases }) });
	}

	return exports;
};
