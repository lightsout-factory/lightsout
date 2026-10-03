import type { FrameworkCarveOut } from '../types/FrameworkCarveOut.ts';

/**
 * Keyed on the dependency: a framework mandate is a fact about what a package
 * declares it depends on, never a guess from what its folders hold.
 *
 * A row carries ONLY what the framework's own documents mandate: the folder a
 * router owns and the files it resolves by name. A layout
 * this repo prefers is never a row, however widely it is followed — React
 * mandates no folder structure, and NestJS wires by decorators rather than by
 * directory, so neither one's familiar vocabulary is a fact either of them
 * states. Mixing a preference in here is how a rule comes to concede to
 * something no framework ever asked for.
 */
const carveOutSignals: Record<string, Partial<Omit<FrameworkCarveOut, 'directory'>>> = {
	'@nestjs/core': { entryFiles: ['main.ts'] },
	next: { routerRoots: ['app', 'pages'] },
	'@tanstack/react-router': { routerRoots: ['routes'] },
	'@tanstack/react-start': { routerRoots: ['routes'], entryFiles: ['router.tsx', 'server.ts', 'client.tsx'] },
	'@remix-run/react': { routerRoots: ['routes'] },
	'expo-router': { routerRoots: ['app'] },
};

interface Params {
	/** Declared dependency names per package directory, exactly as the file-list input carries them. */
	dependencies: Map<string, string[]>;
}

/**
 * A package that declares no framework this list knows still gets an entry —
 * with no exemptions at all, which is the doc's plain default rather than a gap.
 *
 * Ordered longest directory first, so a caller matching a path against these
 * entries takes the nearest manifest and reaches the repo root (`.`, which
 * matches every path) only last.
 */
export const getFrameworkCarveOuts = ({ dependencies }: Params): FrameworkCarveOut[] =>
	[...dependencies]
		.sort(([first], [second]) => second.length - first.length)
		.map(([directory, names]) => {
			const signals = Object.entries(carveOutSignals)
				.filter(([dependency]) => names.includes(dependency))
				.map(([, signal]) => signal);

			return {
				directory,
				entryFiles: [...new Set(signals.flatMap((signal) => signal.entryFiles ?? []))],
				exemptFolderNames: [...new Set(signals.flatMap((signal) => signal.exemptFolderNames ?? []))],
				routerRoots: [...new Set(signals.flatMap((signal) => signal.routerRoots ?? []))],
			};
		});
