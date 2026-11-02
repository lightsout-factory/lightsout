import { Framework } from '#src/common/constants/Framework.ts';

/**
 * The mark each built-in pack shows, keyed by pack address. The key order is
 * the order the packs page lists them in: the general packs first, then one
 * per framework.
 */
export const packFrameworks: Record<string, Framework> = {
	'lightsout/fractal': Framework.TypeScript,
	'lightsout/code-style': Framework.TypeScript,
	'lightsout/standards': Framework.TypeScript,
	'lightsout/react': Framework.React,
	'lightsout/tanstack-start': Framework.TanStack,
};
