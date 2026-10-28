import { docPages } from '#src/features/docs/common/constants/docPages.ts';

/**
 * A doc links to another as a file beside it — `monorepos.md#section` — because
 * that is the link that works on GitHub. On the site the same doc lives at
 * `/docs/monorepos`, so a link to a doc the site carries is rewritten, and any
 * other link is left as written.
 */
export const resolveDocHref = (href: string): string | undefined => {
	const match = /^(?:\.\/)?([\w-]+)\.md(#.*)?$/.exec(href);
	const name = match?.[1];

	return name === undefined || docPages[name] === undefined ? undefined : `/docs/${name}${match?.[2] ?? ''}`;
};
