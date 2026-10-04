import { ImportTargetKind } from '../constants/ImportTargetKind.ts';
import { getDirectory } from '../paths/getDirectory.ts';
import { joinPath } from '../paths/joinPath.ts';
import type { ImportTarget } from '../types/ImportTarget.ts';
import type { PathAliases } from '../types/PathAliases.ts';

/**
 * The specifier is tried unchanged first, because `allowImportingTsExtensions`
 * lets a specifier carry its own `.ts` — the form Node's type stripping needs.
 * Probed only by appending, `./CloneSpan.ts` becomes a search for
 * `CloneSpan.ts.ts`.
 */
const findFile = ({ base, files }: { base: string; files: Set<string> }): string | undefined =>
	[base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`].find((candidate) => files.has(candidate));

const fromProbe = ({ found }: { found: string | undefined }): ImportTarget =>
	found === undefined ? { kind: ImportTargetKind.Unknown } : { kind: ImportTargetKind.File, path: found };

/** A pattern with no `*` matches only exactly, and captures nothing — as TypeScript reads it. */
const capture = ({ pattern, specifier }: { pattern: string; specifier: string }): string | undefined => {
	const star = pattern.indexOf('*');

	if (star === -1) {
		return pattern === specifier ? '' : undefined;
	}

	const prefix = pattern.slice(0, star);
	const suffix = pattern.slice(star + 1);

	return specifier.length >= prefix.length + suffix.length && specifier.startsWith(prefix) && specifier.endsWith(suffix)
		? specifier.slice(prefix.length, specifier.length - suffix.length)
		: undefined;
};

/**
 * The point is what it excludes. `@/agents/x` has an empty scope, `~/foo` and
 * `#internal/foo` start with characters no package name may — none of the three
 * could ever be installed, so each is an alias whose mapping this run does not
 * have, not a dependency.
 */
const isPackageSpecifier = ({ specifier }: { specifier: string }): boolean =>
	/^node:|^(?:@[a-zA-Z0-9][a-zA-Z0-9._-]*\/)?[a-zA-Z0-9][a-zA-Z0-9._-]*(?:\/|$)/.test(specifier);

/** Longest prefix first — TypeScript's own precedence, so `@/common/*` wins over `@/*` for `@/common/utils/x`. */
const matchAlias = ({ aliases, specifier }: { aliases: PathAliases; specifier: string }) =>
	[...aliases.patterns]
		.map(([pattern, targets]) => ({ targets, captured: capture({ pattern, specifier }) }))
		.filter((entry): entry is { targets: string[]; captured: string } => entry.captured !== undefined)
		.sort((first, second) => first.captured.length - second.captured.length)[0];

interface Params {
	/** Repo-relative path of the file the specifier is written in — its folder anchors a relative specifier. */
	from: string;
	/** The module specifier exactly as written. */
	specifier: string;
	/** Every file in scope — the universe a specifier resolves against. */
	files: Set<string>;
	/**
	 * The importing package's path aliases, or undefined when they could not be
	 * determined. Undefined is not "there are none": it makes every non-relative
	 * specifier `unknown`, because an alias and a published package are written
	 * the same way and only this map tells them apart.
	 */
	aliases: PathAliases | undefined;
}

/**
 * `unknown` matters: an index file that imports through an alias resolves to nothing
 * until the alias map is in hand, and a rule reading that as "this index file
 * exports no files" would report every file in the package as private. Without
 * aliases, every non-relative specifier is `unknown`, because an alias and a
 * published package are written the same way.
 */
export const resolveImport = ({ from, specifier, files, aliases }: Params): ImportTarget => {
	// A relative specifier always named a local file, whatever the aliases say.
	if (specifier.startsWith('.')) {
		return fromProbe({ found: findFile({ base: joinPath({ from: getDirectory({ path: from }), specifier }), files }) });
	}

	if (aliases === undefined) {
		return { kind: ImportTargetKind.Unknown };
	}

	const matched = matchAlias({ aliases, specifier });

	// No alias in the tsconfig claims it. That is only proof it is a package when
	// the specifier could BE one — an alias configured somewhere the tsconfig does
	// not reach (a bundler's own resolve.alias, a jsconfig) is still a local file,
	// and calling it external would leave the index file looking fully read while a
	// file it exports looked private.
	if (matched === undefined) {
		return isPackageSpecifier({ specifier }) ? { kind: ImportTargetKind.External } : { kind: ImportTargetKind.Unknown };
	}

	const bases = matched.targets.map((target) => joinPath({ from: aliases.base, specifier: target.replace('*', matched.captured) }));

	return fromProbe({ found: bases.map((base) => findFile({ base, files })).find((candidate) => candidate !== undefined) });
};
