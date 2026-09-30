/** Synonyms are how duplicates hide from name search. */
const verbSynonyms: Record<string, string> = {
	fetch: 'get',
	load: 'get',
	retrieve: 'get',
	read: 'get',
	make: 'create',
	generate: 'create',
	produce: 'create',
	remove: 'delete',
	modify: 'update',
	verify: 'validate',
	check: 'validate',
};

const getTokens = ({ name }: { name: string }) =>
	name
		.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
		.split(/[\s\-_.]+/)
		.filter(Boolean)
		.map((token) => token.toLowerCase())
		.map((token) => verbSynonyms[token] ?? token);

interface Params {
	/** Extension already stripped, e.g. via `getExportName`. */
	name: string;
}

/**
 * Conversion names are order-sensitive — `hexToRgb` and `rgbToHex` are
 * opposites, not one concept — so a `to`/`from` token pins word order instead of
 * sorting.
 *
 * Mirrored rather than imported: a standards library ships as a bare directory
 * with no `node_modules`, and the engine runs against whatever library
 * `standards-libraries` registers, so neither copy can import the other.
 *
 * @mirrors packages/standards-typescript/common/naming/getNameKey.ts
 */
export const getNameKey = ({ name }: Params): string => {
	const tokens = getTokens({ name });

	return tokens.includes('to') || tokens.includes('from') ? tokens.join(' ') : [...tokens].sort().join(' ');
};
