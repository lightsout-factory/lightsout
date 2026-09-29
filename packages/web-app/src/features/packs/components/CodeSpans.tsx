interface Props {
	/** Plain text in which backticks mark code. */
	text: string;
}

/** A lone backtick with no partner is kept as text. */
const splitOnCode = ({ text }: Props) => [...text.matchAll(/`[^`]+`|[^`]+|`/g)].map((match) => ({ part: match[0], start: match.index }));

export const CodeSpans = ({ text }: Props) =>
	splitOnCode({ text }).map(({ part, start }) =>
		part.length > 1 && part.startsWith('`') && part.endsWith('`') ? (
			<code key={start} className="rounded bg-muted px-1 py-px font-mono text-[0.9em] text-foreground">
				{part.slice(1, -1)}
			</code>
		) : (
			<span key={start}>{part}</span>
		),
	);
