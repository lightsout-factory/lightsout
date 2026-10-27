import type { CommandCatalogEntry } from '@lightsout/engine';
import { Link } from '@tanstack/react-router';
import { ArrowRight } from 'lucide-react';
import { CodeSpans } from '#src/appUI/CodeSpans.tsx';
import { RecordKindTag } from '#src/features/commands/internal/components/RecordKindTag.tsx';

interface Props {
	entry: CommandCatalogEntry;
}

/**
 * The whole card is the link. The title is the slash form where the plugin
 * ships a skill, because that is the string a reader would type, and the bare
 * command word otherwise; the full CLI form sits under it.
 */
export const CommandCard = ({ entry }: Props) => (
	<article className="h-full">
		<Link
			to="/commands/$command"
			params={{ command: entry.id }}
			className="group flex h-full flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary-tint-border hover:shadow-md"
		>
			<div className="flex flex-col gap-0.5">
				<h3 className="break-words font-bold font-mono text-drop-navy text-lg">{entry.slash ?? entry.id}</h3>
				{entry.cli === undefined ? null : <span className="font-mono text-muted-foreground text-xs">{entry.cli}</span>}
			</div>
			<p className="text-muted-foreground text-sm leading-relaxed">
				<CodeSpans text={entry.summary} />
			</p>
			<div className="mt-auto flex flex-wrap items-center justify-between gap-2">
				<RecordKindTag records={entry.records} />
				<span className="ml-auto inline-flex items-center gap-1 font-semibold text-primary text-sm">
					Details
					<ArrowRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-0.5" />
				</span>
			</div>
		</Link>
	</article>
);
