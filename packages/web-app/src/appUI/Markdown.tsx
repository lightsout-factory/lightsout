import { createElement, isValidElement, type ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { DefinitionList } from '#src/appUI/DefinitionList.tsx';
import type { DefinitionEntry } from '#src/common/types/DefinitionEntry.ts';
import { slugifyHeading } from '#src/common/utils/slugifyHeading.ts';

/** Where a plan may link: the web, a repo-relative path, or an anchor in the document itself. */
const safeHref = /^(https?:\/\/|\/|\.{1,2}\/|#)/;

const parseEntries = ({ lines }: { lines: string[] }) => {
	const entries: Record<string, string> = {};

	for (const line of lines) {
		const separator = line.indexOf(':');

		if (separator > 0) {
			entries[line.slice(0, separator).trim()] = line
				.slice(separator + 1)
				.trim()
				.replace(/^['"]|['"]$/g, '');
		}
	}

	return entries;
};

/**
 * Only a `---` on the very first line opens a block, so the `---` a plan uses as
 * a horizontal rule further down stays in the body.
 */
const splitFrontMatter = ({ text }: { text: string }) => {
	const lines = text.split('\n');
	const closing = lines[0]?.trim() === '---' ? lines.findIndex((line, index) => index > 0 && line.trim() === '---') : -1;
	let split: { frontMatter: Record<string, string>; body: string } = { frontMatter: {}, body: text };

	if (closing > 0) {
		split = { frontMatter: parseEntries({ lines: lines.slice(1, closing) }), body: lines.slice(closing + 1).join('\n') };
	}

	return split;
};

const styled = ({ tag, className }: { tag: string; className: string }) => {
	const Styled = ({ children }: { children?: ReactNode }) => createElement(tag, { className }, children);

	return Styled;
};

/**
 * A heading spelling one word in backticks arrives as an array with an element
 * in the middle, and the id has to come out the same either way.
 */
const flattenText = ({ node }: { node: ReactNode }): string => {
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
const anchored = ({ tag, className }: { tag: string; className: string }) => {
	const Anchored = ({ children }: { children?: ReactNode }) =>
		createElement(tag, { className, id: slugifyHeading({ text: flattenText({ node: children }) }) }, children);

	return Anchored;
};

/** An href outside `safeHref` renders as plain text rather than as a link nobody vetted. */
const MarkdownLink = ({ href, children }: { href?: string; children?: ReactNode }) => {
	if (href === undefined || !safeHref.test(href)) {
		return <span className="text-muted-foreground-strong">{children}</span>;
	}

	const samePage = href.startsWith('#');

	return (
		<a href={href} target={samePage ? undefined : '_blank'} rel={samePage ? undefined : 'noreferrer'} className="text-brand-to underline underline-offset-4">
			{children}
		</a>
	);
};

/**
 * Raw HTML in a plan is never rendered — `react-markdown` drops it unless a
 * `rehype-raw` plugin is added, and none is.
 */
const components: Components = {
	h1: styled({ tag: 'h1', className: 'mt-6 mb-3 font-semibold text-foreground text-xl first:mt-0' }),
	h2: anchored({ tag: 'h2', className: 'mt-6 mb-2 font-semibold text-foreground text-lg first:mt-0' }),
	h3: anchored({ tag: 'h3', className: 'mt-5 mb-2 font-semibold text-base text-foreground' }),
	h4: styled({ tag: 'h4', className: 'mt-4 mb-1 font-semibold text-foreground text-sm' }),
	p: styled({ tag: 'p', className: 'my-3 text-sm leading-6' }),
	ul: styled({ tag: 'ul', className: 'my-3 list-disc space-y-1 pl-6 text-sm' }),
	ol: styled({ tag: 'ol', className: 'my-3 list-decimal space-y-1 pl-6 text-sm' }),
	li: styled({ tag: 'li', className: 'leading-6' }),
	blockquote: styled({ tag: 'blockquote', className: 'my-3 border-border border-l-2 pl-4 text-muted-foreground text-sm' }),
	pre: styled({ tag: 'pre', className: 'my-3 overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs leading-5' }),
	code: styled({ tag: 'code', className: 'rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]' }),
	table: styled({ tag: 'table', className: 'my-3 w-full border-collapse text-left text-xs' }),
	thead: styled({ tag: 'thead', className: 'border-border border-b' }),
	tr: styled({ tag: 'tr', className: 'border-border border-b last:border-0' }),
	th: styled({ tag: 'th', className: 'px-2 py-1.5 font-semibold' }),
	td: styled({ tag: 'td', className: 'px-2 py-1.5 align-top' }),
	hr: styled({ tag: 'hr', className: 'my-6 border-border border-t' }),
	a: MarkdownLink,
};

interface Props {
	/** The document's raw markdown, front matter included. */
	text: string;
}

/**
 * Front matter is lifted out before the library sees the text, so a YAML block
 * shows as metadata rather than rendering as a heading.
 */
export const Markdown = ({ text }: Props) => {
	const { frontMatter, body } = splitFrontMatter({ text });
	const entries: DefinitionEntry[] = Object.entries(frontMatter).map(([name, value]) => [
		name,
		<span key={name} className="font-mono">
			{value}
		</span>,
	]);

	return (
		<div>
			{entries.length === 0 ? null : <DefinitionList className="mb-4 text-muted-foreground" entries={entries} />}
			<ReactMarkdown components={components} remarkPlugins={[remarkGfm]}>
				{body}
			</ReactMarkdown>
		</div>
	);
};
