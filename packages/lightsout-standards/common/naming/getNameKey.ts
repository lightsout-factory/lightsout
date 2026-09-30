/** The banned synonyms the naming document lists, each mapped to the verb it must be written as. */
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
	/** An export name, extension already stripped — `getExportName` supplies it. */
	name: string;
}

/**
 * Conversion names are the one place word order carries meaning — `hexToRgb`
 * and `rgbToHex` are deliberate opposites, not one concept — so a `to` or
 * `from` token pins the order instead of sorting it away.
 *
 * Kept identical to the engine's copy so this rule and plan-time prior-art
 * detection never disagree. The copy cannot be collapsed: this package ships as
 * a bare directory with no manifest and no `node_modules`, so every value it
 * imports has to resolve inside its own tree. Change one, change the other.
 *
 * @mirrors packages/engine/src/plan/internal/common/naming/getNameKey.ts
 */
export const getNameKey = ({ name }: Params): string => {
	const tokens = getTokens({ name });

	return tokens.includes('to') || tokens.includes('from') ? tokens.join(' ') : [...tokens].sort().join(' ');
};
