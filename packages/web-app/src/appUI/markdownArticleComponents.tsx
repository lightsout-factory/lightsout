import type { ReactNode } from 'react';
import type { Components } from 'react-markdown';
import { MarkdownCodeBlock } from '#src/appUI/MarkdownCodeBlock.tsx';
import { anchored, styled } from '#src/appUI/markdownParts.tsx';

export const articleLinkClass = 'font-medium text-primary underline decoration-primary/30 underline-offset-4 transition-colors hover:decoration-primary';

/** A wide table scrolls inside its own frame rather than widening the page. */
const ArticleTable = ({ children }: { children?: ReactNode }) => (
	<div className="my-6 overflow-x-auto rounded-xl border border-border">
		<table className="w-full border-collapse text-left text-sm [&_td:first-child]:whitespace-nowrap">{children}</table>
	</div>
);

/**
 * The type scale the public site's own pages use, for a document read at
 * length: headings in the site's navy, body at a comfortable measure, and
 * anchors that land below the sticky site header.
 */
export const articleComponents: Components = {
	h1: styled({ tag: 'h1', className: 'mt-12 mb-4 font-extrabold text-3xl text-drop-navy tracking-tight first:mt-0' }),
	h2: anchored({
		tag: 'h2',
		className: 'mt-14 mb-4 scroll-mt-24 border-border border-t pt-10 font-bold text-2xl text-drop-navy tracking-tight first:mt-0 first:border-0 first:pt-0',
	}),
	h3: anchored({ tag: 'h3', className: 'mt-10 mb-3 scroll-mt-24 font-bold text-drop-navy text-lg' }),
	h4: styled({ tag: 'h4', className: 'mt-8 mb-2 font-semibold text-base text-drop-navy' }),
	p: styled({ tag: 'p', className: 'my-4 text-[15px] text-foreground leading-7' }),
	ul: styled({ tag: 'ul', className: 'my-4 list-disc space-y-2 pl-6 text-[15px] leading-7 marker:text-muted-foreground' }),
	ol: styled({ tag: 'ol', className: 'my-4 list-decimal space-y-2 pl-6 text-[15px] leading-7 marker:text-muted-foreground' }),
	li: styled({ tag: 'li', className: 'pl-1' }),
	blockquote: styled({ tag: 'blockquote', className: 'my-6 rounded-r-lg border-primary border-l-4 bg-primary-tint px-4 py-1 text-[15px]' }),
	pre: MarkdownCodeBlock,
	code: styled({ tag: 'code', className: 'rounded-md border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-[0.85em] text-drop-navy' }),
	table: ArticleTable,
	thead: styled({ tag: 'thead', className: 'bg-muted/50' }),
	tr: styled({ tag: 'tr', className: 'border-border border-t first:border-t-0' }),
	th: styled({ tag: 'th', className: 'whitespace-nowrap px-4 py-2.5 font-semibold text-muted-foreground-strong text-xs uppercase tracking-wide' }),
	td: styled({ tag: 'td', className: 'px-4 py-3 align-top leading-6' }),
	hr: styled({ tag: 'hr', className: 'my-10 border-border' }),
};
