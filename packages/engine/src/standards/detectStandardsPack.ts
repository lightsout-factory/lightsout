import { readDependencyNames } from '#src/common/workspace/readDependencyNames.ts';

/** Most specific first, and the first match wins: a TanStack Start app also depends on React. */
const packSignals: { address: string; signals: string[] }[] = [
	{ address: 'lightsout/tanstack-start-app', signals: ['@tanstack/react-start', '@tanstack/start'] },
	{ address: 'lightsout/nestjs-app', signals: ['@nestjs/core'] },
	{ address: 'lightsout/react-app', signals: ['react', 'preact', 'react-dom'] },
];

interface Params {
	/** Absolute path of the package.json to read — the root one for the root group. */
	manifestPath: string;
}

/**
 * The zero-setup default when the config names no pack. A missing or unreadable
 * manifest declares nothing, so it gets the node pack rather than an error: the
 * package fails later, at gate time, with a better one.
 *
 * @returns A lightsout pack address, `<library>/<pack>`.
 */
export const detectStandardsPack = async ({ manifestPath }: Params): Promise<string> => {
	const dependencies = new Set(await readDependencyNames({ manifestPath }));
	const match = packSignals.find(({ signals }) => signals.some((signal) => dependencies.has(signal)));

	return match?.address ?? 'lightsout/node';
};
