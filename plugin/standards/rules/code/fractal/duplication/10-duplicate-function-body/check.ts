import type { RawStandardsFinding, StandardsCheckModule, SyntaxTreeInput } from '@lightsout/standards-contracts';
import { buildRawFinding } from '#common/findings/buildRawFinding.ts';
import { getSiteGroupKey } from '#common/findings/getSiteGroupKey.ts';
import { collectFunctionNodes } from '#common/parsing/collectFunctionNodes.ts';
import { isDelegationForwardBody } from '#common/parsing/isDelegationForwardBody.ts';
import { getOwningPack } from '#common/paths/getOwningPack.ts';
import { normalizeFunctionTokens } from './normalizeFunctionTokens.ts';

interface BodySite {
	name: string;
	path: string;
	startLine: number;
	endLine: number;
	tokenCount: number;
}

/**
 * The token stream is its own key: a hash would buy a collision the rule could
 * never explain. Grouped within one shipped pack, because a standards package
 * installs where the rest of this repo is absent, so a function it shares with
 * the engine cannot be deduplicated.
 */
const groupByBody = ({ input, minBodyTokens }: { input: SyntaxTreeInput; minBodyTokens: number }) => {
	const byBody = new Map<string, BodySite[]>();

	for (const [path, tree] of input.trees) {
		for (const { name, startLine, endLine, body } of collectFunctionNodes({ sourceFile: tree, compiler: input.compiler })) {
			const tokens = normalizeFunctionTokens({ node: body, compiler: input.compiler });

			// A one-line forward to a `this`-held collaborator is the shape the
			// composition-over-inheritance rule mandates — never a duplicate
			// candidate, however many classes hold the same collaborator.
			if (tokens.length >= minBodyTokens && !isDelegationForwardBody({ body, compiler: input.compiler })) {
				const key = `${getOwningPack({ path, standardsLibraries: input.standardsLibraries })}:${tokens.join(',')}`;

				byBody.set(key, [...(byBody.get(key) ?? []), { name, path, startLine, endLine, tokenCount: tokens.length }]);
			}
		}
	}

	return byBody;
};

/**
 * Groups over the same file set become one finding: a body in the key would
 * re-mint the identity on any edit, which a debt ledger and a gate cannot
 * survive.
 */
const mergeByFileSet = ({ groups }: { groups: BodySite[][] }) => {
	const bySite = new Map<string, { files: RawStandardsFinding['files']; described: string[] }>();

	for (const group of groups) {
		if (group.length > 1) {
			const [first] = group;
			const files = group.map(({ path, startLine, endLine }) => ({ path, startLine, endLine }));
			const key = getSiteGroupKey({ files });
			const entry = bySite.get(key) ?? { files: [], described: [] };

			bySite.set(key, {
				files: [...entry.files, ...files],
				described: [...entry.described, `${group.map(({ name }) => `'${name}'`).join(', ')} (${first.tokenCount} tokens)`],
			});
		}
	}

	return bySite;
};

export const check: StandardsCheckModule = {
	inputKinds: ['syntax-tree'],
	// Tier 2 of the duplication ladder: two bodies that match once their names
	// and literals are set aside are the same function written twice under new
	// names, which comparing the text side by side cannot see.
	run: ({ inputs, options }): RawStandardsFinding[] => {
		const input = inputs['syntax-tree'];
		const groups = input === undefined ? [] : [...groupByBody({ input, minBodyTokens: options.minBodyTokens }).values()];

		return [...mergeByFileSet({ groups }).values()].map(({ files, described }) =>
			buildRawFinding({
				rule: 'duplicate-function-body',
				files,
				detail: `${described.join('; ')} have the same body under different names`,
				guidance: 'Renaming the identifiers did not make these different functions.',
			}),
		);
	},
};
