import type { CommandCatalogEntry } from '@lightsout/engine/contracts';
import { Link } from '@tanstack/react-router';
import { CodeSpans } from '#src/appUI/CodeSpans.tsx';
import { SiteSection } from '#src/appUI/SiteSection.tsx';
import { RecordKindTag } from '#src/features/commands/internal/components/RecordKindTag.tsx';
import { CommandSteps } from '#src/features/commands/screens/CommandDetail/internal/components/CommandSteps.tsx';
import { CommandUsage } from '#src/features/commands/screens/CommandDetail/internal/components/CommandUsage.tsx';

interface Props {
	entry: CommandCatalogEntry;
}

/** Titled as its row on the list is: what a reader types — the slash form for a skill, else the full CLI line. A skill that also has a CLI form tags it under the title. */
export const CommandManual = ({ entry }: Props) => (
	<>
		<header className="flex flex-col gap-4">
			<h1 className="break-words font-bold font-mono text-3xl text-drop-navy md:text-4xl">{entry.slash ?? entry.cli ?? entry.id}</h1>
			<p className="max-w-3xl text-lg text-muted-foreground leading-relaxed">
				<CodeSpans text={entry.summary} />
			</p>
			<div className="flex flex-wrap items-center gap-2">
				{entry.slash === undefined || entry.cli === undefined ? null : (
					<span className="rounded-md border border-border px-2 py-1 font-mono text-muted-foreground-strong text-xs">{entry.cli}</span>
				)}
				<RecordKindTag records={entry.records} />
			</div>
		</header>
		<SiteSection title="When to reach for it">
			<p className="max-w-3xl text-base leading-7">
				<CodeSpans text={entry.whenToUse} />
			</p>
		</SiteSection>
		{entry.invocations.length === 0 ? null : (
			<SiteSection title="How to run it">
				<CommandUsage entry={entry} />
			</SiteSection>
		)}
		{entry.steps.length === 0 ? null : (
			<SiteSection title="What happens">
				<CommandSteps steps={entry.steps} />
			</SiteSection>
		)}
		{entry.related.length === 0 ? null : (
			<SiteSection title="Related commands">
				<ul className="flex flex-wrap gap-2">
					{entry.related.map((id) => (
						<li key={id}>
							<Link
								to="/commands/$command"
								params={{ command: id }}
								className="inline-flex rounded-lg border border-border px-3 py-1.5 font-mono font-semibold text-drop-navy text-sm transition-colors hover:border-primary-tint-border hover:bg-muted/40"
							>
								{id}
							</Link>
						</li>
					))}
				</ul>
			</SiteSection>
		)}
	</>
);
