interface Params {
	/** A heading's text — either the flattened children of a rendered heading, or the raw markdown line minus its hashes. */
	text: string;
}

/**
 * `Markdown` puts this id on the heading it renders and `DocToc` links to it from
 * the raw line, so both sides must share this one algorithm.
 */
export const slugifyHeading = ({ text }: Params): string =>
	text
		.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
		.replace(/[`*_~[\]]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
