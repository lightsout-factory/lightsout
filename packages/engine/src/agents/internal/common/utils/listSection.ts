interface Params {
	/** The section's heading text, without the `#`. */
	heading: string;
	/** The sentence that introduces the list. */
	intro: string;
	/** One Markdown bullet per entry. */
	items: string[];
	/** The bullets stating the rules that bind the listed entries. */
	rules: string[];
}

export const listSection = ({ heading, intro, items, rules }: Params): string | undefined =>
	items.length === 0 ? undefined : [`# ${heading}`, '', intro, '', ...items, '', ...rules].join('\n');
