import type { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';

interface Params {
	/** The consumer's config, or nothing when a caller could not read one. */
	config?: Pick<LightsoutConfig, 'generated' | 'vendored'>;
}

/**
 * One function, so every caller asking "what is not this repo's source?" gets
 * the same answer.
 *
 * Attribution (`collectChanged`) deliberately does not use it: generated output
 * is the by-product of a change made elsewhere, while a vendored file has no
 * source in the repo, so editing one is the change.
 */
export const excludedSourcePaths = ({ config }: Params): string[] => [...(config?.generated ?? []), ...(config?.vendored ?? [])];
