import type { CommandCatalogEntry } from '@lightsout/engine';
import { Link } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';
import { CodeSpans } from '#src/appUI/CodeSpans.tsx';
import { RecordKindTag } from '#src/features/commands/internal/components/RecordKindTag.tsx';

interface Props {
	entry: CommandCatalogEntry;
	/** What the reader types: the slash form under Skills, the full CLI form under CLI. */
	title: string;
	/** A row sits one level under the heading it is listed beneath. */
	headingLevel: 3 | 4;
}

/** One line of the reference list: the name on the left, what it does on the right. The whole row is the link. */
export const CommandRow = ({ entry, title, headingLevel }: Props) => {
	const Heading = headingLevel === 3 ? 'h3' : 'h4';

	return (
		<li>
			<Link
				to="/commands/$command"
				params={{ command: entry.id }}
				className="group flex flex-col gap-1.5 px-5 py-4 transition-colors hover:bg-muted/40 md:flex-row md:items-center md:gap-6"
			>
				<Heading className="shrink-0 break-words font-bold font-mono text-drop-navy text-sm md:w-72">{title}</Heading>
				<div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
					<p className="flex-1 text-muted-foreground text-sm leading-relaxed">
						<CodeSpans text={entry.summary} />
					</p>
					<RecordKindTag records={entry.records} />
				</div>
				<ChevronRight
					aria-hidden="true"
					className="hidden size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary md:block"
				/>
			</Link>
		</li>
	);
};
