import { z } from 'zod';

/** A manifest is not this engine's schema to police, so the values are left unconstrained. */
const Manifest = z.object({ scripts: z.record(z.string(), z.unknown()).optional() });

interface Params {
	/** Trusted to be neither valid JSON nor a manifest. */
	raw: string;
}

export const getManifestScriptKeys = ({ raw }: Params): Set<string> => {
	try {
		const parsed = Manifest.safeParse(JSON.parse(raw));

		return new Set(parsed.success ? Object.keys(parsed.data.scripts ?? {}) : []);
	} catch {
		return new Set();
	}
};
