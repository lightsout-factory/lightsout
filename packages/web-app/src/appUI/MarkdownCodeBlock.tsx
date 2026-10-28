import { isValidElement, type ReactNode } from 'react';
import { CopyButton } from '#src/appUI/buttons/CopyButton.tsx';
import { CodeBlock } from '#src/appUI/CodeBlock.tsx';

/** A fence's language, as the caption names it and the highlighter reads it; `jsonc` highlights as JSON. */
const fenceCaptions: Record<string, string> = { jsonc: 'json' };

interface Props {
	/** The single `<code>` element `react-markdown` puts inside a fenced block. */
	children?: ReactNode;
}

/** A fenced block in an article: highlighted where the language is known, captioned with it, and copyable. */
export const MarkdownCodeBlock = ({ children }: Props) => {
	const code = isValidElement<{ className?: string; children?: ReactNode }>(children) ? children : undefined;
	const fence = /language-([\w-]+)/.exec(code?.props.className ?? '')?.[1] ?? 'text';
	const text = String(code?.props.children ?? '').replace(/\n$/, '');
	const caption = fenceCaptions[fence] ?? fence;

	return <CodeBlock text={text} path={caption} className="my-6" action={<CopyButton value={text} label={`Copy ${caption}`} isLabelHidden />} />;
};
