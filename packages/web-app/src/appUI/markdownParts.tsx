import { createElement, isValidElement, type ReactNode } from 'react';
import { slugifyHeading } from '#src/common/utils/slugifyHeading.ts';

export const styled = ({ tag, className }: { tag: string; className: string }) => {
	const Styled = ({ children }: { children?: ReactNode }) => createElement(tag, { className }, children);

	return Styled;
};

/**
 * A heading spelling one word in backticks arrives as an array with an element
 * in the middle, and the id has to come out the same either way.
 */
export const flattenText = ({ node }: { node: ReactNode }): string => {
	let text = '';

	if (typeof node === 'string' || typeof node === 'number') {
		text = String(node);
	} else if (Array.isArray(node)) {
		text = node.map((child) => flattenText({ node: child })).join('');
	} else if (isValidElement<{ children?: ReactNode }>(node)) {
		text = flattenText({ node: node.props.children });
	}

	return text;
};

/** Only h2 and h3 get an anchor id — those are the levels `DocToc` lists. */
export const anchored = ({ tag, className }: { tag: string; className: string }) => {
	const Anchored = ({ children }: { children?: ReactNode }) =>
		createElement(tag, { className, id: slugifyHeading({ text: flattenText({ node: children }) }) }, children);

	return Anchored;
};
