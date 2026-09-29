import { StandardsPackBundleCache } from '#src/views/internal/common/services/StandardsPackBundleCache.ts';

/**
 * A single instance is the whole point: each server-function call is its own
 * pass through `listStandardsPackBundles`, and a per-call cache would re-read
 * the pack for every one of them.
 */
export const standardsPackBundleCache = new StandardsPackBundleCache();
