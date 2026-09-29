import { Highlight, type Token } from 'prism-react-renderer';
import type { ReactNode } from 'react';
import { codeTheme } from '#src/common/constants/codeTheme.ts';
import { cn } from '#src/common/utils/cn.ts';
import { toCodeLanguage } from '#src/common/utils/toCodeLanguage.ts';

/**
 * The offset is a stable key: lines or tokens may repeat text, but never at the
 * same place — which is why an empty token is dropped before counting.
 */
const withOffsets = <Item,>({ items, lengthOf, gap }: { items: Item[]; lengthOf: (item: Item) => number; gap: number }) => {
	let offset = 0;

	return items.map((item) => {
		const start = offset;

		offset += lengthOf(item) + gap;

		return { item, start };
	});
};

const lineLength = (line: Token[]) => line.reduce((length, token) => length + token.content.length, 0);

interface Props {
	/** The file's text, shown verbatim — comments included, since they are often half of what an example teaches. */
	text: string;
	/** The file's path. It picks the highlighting, and is shown as the caption unless `isCaptionHidden`. */
	path: string;
	isCaptionHidden?: boolean;
	/** A control at the caption's right end — a copy button, say. Shown only with the caption. */
	action?: ReactNode;
	className?: string;
}

/**
 * Highlighting yields React elements rather than an HTML string, so nothing
 * here reaches `dangerouslySetInnerHTML`.
 */
export const CodeBlock = ({ text, path, isCaptionHidden = false, action, className }: Props) => (
	<figure className={cn('overflow-hidden rounded-lg border border-border bg-muted/40', className)}>
		{isCaptionHidden ? null : (
			<figcaption className="flex min-h-9 items-center justify-between gap-2 border-border border-b bg-muted/60 py-1 pr-1 pl-4">
				<span className="truncate font-mono text-muted-foreground text-xs" title={path}>
					{path}
				</span>
				{action}
			</figcaption>
		)}
		<Highlight code={text.replace(/\n$/, '')} language={toCodeLanguage({ path }) ?? 'plain'} theme={codeTheme}>
			{({ tokens, getLineProps, getTokenProps }) => (
				<pre className="max-h-[32rem] overflow-auto p-4 font-mono text-[0.75rem] leading-5">
					{withOffsets({ items: tokens, lengthOf: lineLength, gap: 1 }).map(({ item: line, start: lineStart }) => (
						<div key={lineStart} {...getLineProps({ line })}>
							{withOffsets({ items: line.filter((token) => token.content !== ''), lengthOf: (token) => token.content.length, gap: 0 }).map(
								({ item: token, start }) => (
									<span key={start} {...getTokenProps({ token })} />
								),
							)}
						</div>
					))}
				</pre>
			)}
		</Highlight>
	</figure>
);
