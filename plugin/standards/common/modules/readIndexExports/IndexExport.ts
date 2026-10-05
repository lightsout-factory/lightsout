import type { ImportTarget } from '../../types/ImportTarget.ts';

export interface IndexExport {
	/** Empty for an `export *` line, which names none. */
	names: string[];
	star: boolean;
	specifier: string;
	target: ImportTarget;
}
