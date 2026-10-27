import { Link } from '@tanstack/react-router';
import { cn } from '#src/common/utils/cn.ts';
import { docPages } from '#src/features/docs/common/constants/docPages.ts';

interface Props {
	/** The doc the page is showing, marked as the current one. */
	current: string;
}

/** Every doc the site carries. A row of tabs on a narrow screen, a column beside the article on a wide one. */
export const DocNav = ({ current }: Props) => (
	<nav aria-label="Docs" className="flex flex-col gap-3">
		<span className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">Docs</span>
		<ul className="flex flex-wrap gap-1 lg:flex-col">
			{Object.entries(docPages).map(([name, page]) =>
				page === undefined ? null : (
					<li key={name}>
						<Link
							to="/docs/$doc"
							params={{ doc: name }}
							aria-current={name === current ? 'page' : undefined}
							className={cn(
								'block rounded-lg px-3 py-1.5 font-medium text-sm transition-colors',
								name === current ? 'bg-primary-tint text-primary' : 'text-muted-foreground-strong hover:bg-muted/60 hover:text-foreground',
							)}
						>
							{page.title}
						</Link>
					</li>
				),
			)}
		</ul>
	</nav>
);
