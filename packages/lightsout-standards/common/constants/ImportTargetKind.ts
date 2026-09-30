export const ImportTargetKind = {
	File: 'file',
	/** A published package or a builtin. */
	External: 'external',
	/** Could name a local file, but the mapping needed to say which was unavailable. */
	Unknown: 'unknown',
} as const;

export type ImportTargetKind = (typeof ImportTargetKind)[keyof typeof ImportTargetKind];
