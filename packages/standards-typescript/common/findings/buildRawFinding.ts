import type { RawStandardsFinding } from '@lightsout/standards-contracts';
import { getSiteGroupKey } from './getSiteGroupKey.ts';

interface Params {
	/** The rule id, exactly as its folder names it — the first half of the site key. */
	rule: string;
	files: RawStandardsFinding['files'];
	detail: string;
	guidance: string;
	/** The number this rule compared against its cap, when it has one. */
	measure?: number;
}

/**
 * The site key is built from the rule id and the reported paths alone: a key
 * holding a line number or a symbol name would take a fresh identity whenever
 * code above it moved, so accepted debt would reappear and a resolved finding
 * would read as unresolved.
 */
export const buildRawFinding = ({ rule, files, detail, guidance, measure }: Params): RawStandardsFinding => ({
	siteKey: `${rule}:${getSiteGroupKey({ files })}`,
	files,
	detail,
	guidance,
	// Spread rather than assigned, so an unmeasured rule's finding carries no
	// `measure` key at all — a key holding undefined would change the shape every
	// unmeasured rule asserts on.
	...(measure === undefined ? {} : { measure }),
});
