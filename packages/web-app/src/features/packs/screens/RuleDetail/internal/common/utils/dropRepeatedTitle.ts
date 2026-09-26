import { slugifyHeading } from '#src/common/utils/slugifyHeading.ts';

interface Params {
	/** The rule's prose, as markdown. */
	prose: string;
	/** The rule's id, which the page already shows as its title. */
	ruleId: string;
}

/**
 * A rule's prose without its opening heading when that heading only spells the
 * rule's id — "Props & State" over `props-and-state`
 * — since the page's title already says it. Any other opening is kept.
 *
 * @param prose - the rule's prose
 * @param ruleId - the rule's id
 */
export const dropRepeatedTitle = ({ prose, ruleId }: Params): string => {
	const [first = '', ...rest] = prose.trimStart().split('\n');
	const heading = /^#{1,6}\s+(.+)$/.exec(first);
	const spellsId = heading !== null && slugifyHeading({ text: heading[1].replaceAll('&', 'and') }) === ruleId;

	return spellsId ? rest.join('\n').trimStart() : prose;
};
