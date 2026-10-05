/**
 * Bytes at or below which a file reaches a plan writer whole. Roughly 300
 * lines, just above this repository's 250-line file cap, so only a genuinely
 * oversized file is reduced.
 */
export const wholeFileEvidenceLimit = 12000;
