interface Params {
	tokens: number;
}

const thousand = 1000;
const hundred = 100;

/**
 * Rounded hard and marked approximate, because the figure is an estimate:
 * `~900` below a thousand, `~8.4k` above it.
 */
export const formatTokenEstimate = ({ tokens }: Params): string =>
	tokens < thousand ? `~${Math.round(tokens / hundred) * hundred}` : `~${(tokens / thousand).toFixed(1).replace(/\.0$/, '')}k`;
