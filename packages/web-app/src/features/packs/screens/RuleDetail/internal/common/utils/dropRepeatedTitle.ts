import { slugifyHeading } from '#src/common/utils/slugifyHeading.ts';

interface Params {
	/** The rule's prose, as markdown. */
	prose: string;
	/** The rule's id, which the page already shows as its title. */
	ruleId: string;
}

/** Drops an opening heading that only spells the rule's id ("Props & State" for `props-and-state`), since the page title already shows it. */
export const dropRepeatedTitle = ({ prose, ruleId }: Params): string => {
	const [first = '', ...rest] = prose.trimStart().split('\n');
	const heading = /^#{1,6}\s+(.+)$/.exec(first);
	const spellsId = heading !== null && slugifyHeading({ text: heading[1].replaceAll('&', 'and') }) === ruleId;

	return spellsId ? rest.join('\n').trimStart() : prose;
};
