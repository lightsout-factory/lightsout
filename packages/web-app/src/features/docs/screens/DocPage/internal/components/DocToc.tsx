import { cn } from '#src/common/utils/cn.ts';
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
		<nav aria-label="On this page" className="flex flex-col gap-3">
			<span className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">On this page</span>
			<ul className="flex flex-col border-border border-l">
				{headings.map((heading) => (
					<li key={heading.raw}>
						<a
							href={`#${slugifyHeading({ text: heading.raw })}`}
							className={cn(
								'-ml-px block border-transparent border-l py-1 text-sm transition-colors hover:border-primary hover:text-primary',
								heading.depth === 3 ? 'pl-6 text-muted-foreground' : 'pl-3 font-medium text-muted-foreground-strong',
							)}
						>
							{heading.raw.replace(/`/g, '')}
						</a>
					</li>
				))}
			</ul>
		</nav>
	);
};
