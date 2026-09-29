import { slugifyHeading } from '#src/common/utils/slugifyHeading.ts';

const readHeadings = ({ text }: { text: string }) => {
	const matches = text.split('\n').map((line) => /^(#{2,3}) (.+)$/.exec(line));

	return matches.filter((match) => match !== null).map((match) => ({ depth: match[1]?.length ?? 2, raw: match[2] ?? '' }));
};

interface Props {
	text: string;
}

/**
 * Read from the raw markdown rather than the rendered nodes, because the list
 * has to exist before the document is scrolled past. `Markdown` slugs headings
 * with the same `slugifyHeading`, which is what makes the links land.
 */
export const DocToc = ({ text }: Props) => {
	const headings = readHeadings({ text });

	return headings.length === 0 ? null : (
		<nav aria-label="On this page" className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4">
			<span className="font-medium text-muted-foreground text-xs uppercase tracking-wide">On this page</span>
			{headings.map((heading) => (
				<a
					key={heading.raw}
					href={`#${slugifyHeading({ text: heading.raw })}`}
					className={heading.depth === 3 ? 'pl-4 text-muted-foreground text-sm hover:text-foreground' : 'text-sm hover:text-foreground'}
				>
					{heading.raw.replace(/`/g, '')}
				</a>
			))}
		</nav>
	);
};
