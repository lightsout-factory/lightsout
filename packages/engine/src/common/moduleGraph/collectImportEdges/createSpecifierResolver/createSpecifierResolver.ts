import { posix } from 'node:path';
import type { SpecifierResolver } from '#src/common/moduleGraph/collectImportEdges/createSpecifierResolver/SpecifierResolver.ts';
import type { ImportAliases } from '#src/common/types/ImportAliases.ts';

interface Params {
	files: string[];
	/** Omitted, a `#` specifier resolves by suffix like any other alias. */
	importAliases?: ImportAliases;
}

const stripExtension = ({ path }: { path: string }) => path.replace(/\.(m|c)?[jt]sx?$/i, '');

/**
 * The part of a specifier a pattern's `*` stands for — `''` for an exact key —
 * or undefined when the pattern does not match it.
 */
const matchPattern = ({ pattern, specifier }: { pattern: string; specifier: string }) => {
	const star = pattern.indexOf('*');

	if (star === -1) {
		return pattern === specifier ? '' : undefined;
	}

	const head = pattern.slice(0, star);
	const tail = pattern.slice(star + 1);

	return specifier.length >= head.length + tail.length && specifier.startsWith(head) && specifier.endsWith(tail)
		? specifier.slice(head.length, specifier.length - tail.length)
		: undefined;
};

/**
 * Shared by every pass that must agree on what an import points at. It reads
 * no tsconfig or bundler config, so non-relative, non-`#` specifiers resolve
 * by unique path suffix.
 */
export const createSpecifierResolver = ({ files, importAliases = new Map() }: Params): SpecifierResolver => {
	const byStripped = new Map<string, string>();

	for (const file of files) {
		byStripped.set(stripExtension({ path: file }), file);
	}

	const probe = ({ stripped }: { stripped: string }) => byStripped.get(stripped) ?? byStripped.get(`${stripped}/index`);

	const resolveRelative = ({ from, specifier }: { from: string; specifier: string }) =>
		probe({ stripped: posix.normalize(posix.join(posix.dirname(from), stripExtension({ path: specifier }))) });

	// Single-segment specifiers (external packages like `react`) never reach
	// a matchable tier.
	const resolveBySuffix = ({ specifier }: { specifier: string }) => {
		const segments = stripExtension({ path: specifier }).split('/');

		for (let start = 1; start < segments.length; start += 1) {
			const suffix = segments.slice(start).join('/');
			const matches = [...byStripped.keys()].filter(
				(stripped) => stripped === suffix || stripped.endsWith(`/${suffix}`) || stripped === `${suffix}/index` || stripped.endsWith(`/${suffix}/index`),
			);

			if (matches.length > 1) {
				return undefined;
			}

			if (matches.length === 1 && matches[0] !== undefined) {
				return byStripped.get(matches[0]);
			}
		}

		return undefined;
	};

	// A `#` specifier means one file in the importing package, however many
	// others share its suffix, as in Node. Pattern precedence follows Node too:
	// an exact key beats a wildcard, a longer prefix beats a shorter one.
	const resolveSubpathImport = ({ from, specifier }: { from: string; specifier: string }) => {
		const scope = [...importAliases.keys()]
			.filter((directory) => directory === '.' || from.startsWith(`${directory}/`))
			.sort((first, second) => second.length - first.length)[0];
		const [best] = (scope === undefined ? [] : (importAliases.get(scope) ?? []))
			.flatMap(({ pattern, target }) => {
				const match = matchPattern({ pattern, specifier });

				return match === undefined ? [] : [{ pattern, target, match }];
			})
			.sort((first, second) => (first.pattern.includes('*') ? 1 : 0) - (second.pattern.includes('*') ? 1 : 0) || second.pattern.length - first.pattern.length);

		return scope === undefined || best === undefined
			? { matched: false as const }
			: {
					matched: true as const,
					file: probe({ stripped: posix.normalize(posix.join(scope, stripExtension({ path: best.target.replaceAll('*', best.match) }))) }),
				};
	};

	return ({ from, specifier }) => {
		if (specifier.startsWith('.')) {
			return resolveRelative({ from, specifier });
		}

		const subpathImport = specifier.startsWith('#') ? resolveSubpathImport({ from, specifier }) : { matched: false as const };

		return subpathImport.matched ? subpathImport.file : resolveBySuffix({ specifier });
	};
};
