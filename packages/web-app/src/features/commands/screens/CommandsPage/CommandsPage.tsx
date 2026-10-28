import type { CommandCatalogEntry } from '@lightsout/engine';
import { CommandGroup } from '@lightsout/engine/contracts';
import { useSuspenseQuery } from '@tanstack/react-query';
import { type LucideIcon, Sparkles, Terminal } from 'lucide-react';
import type { ReactNode } from 'react';
import { SitePageFrame } from '#src/appUI/SitePageFrame.tsx';
import { commandGroupDisplays } from '#src/features/commands/internal/common/constants/commandGroupDisplays.ts';
import { commandsQueryOptions } from '#src/features/commands/queries/commandsQueryOptions.ts';
import { CommandRow } from '#src/features/commands/screens/CommandsPage/internal/components/CommandRow.tsx';

const groupOrder = [CommandGroup.Build, CommandGroup.BurnDown, CommandGroup.Standards, CommandGroup.Housekeeping];

const listClass = 'flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-sm';

const KindSection = ({ title, description, Icon, children }: { title: string; description: ReactNode; Icon: LucideIcon; children: ReactNode }) => (
	<section aria-label={title} className="flex flex-col gap-6">
		<div className="flex items-start gap-3">
			<span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-tint text-primary">
				<Icon aria-hidden="true" className="size-5" />
			</span>
			<div className="flex flex-col gap-1">
				<h2 className="font-bold text-2xl text-drop-navy">{title}</h2>
				<p className="text-muted-foreground text-sm">{description}</p>
			</div>
		</div>
		{children}
	</section>
);

/** A command the CLI offers, under the group it belongs to; a group with none is left out. */
const CliGroups = ({ commands }: { commands: CommandCatalogEntry[] }) =>
	groupOrder.map((group) => {
		const entries = commands.filter((entry) => entry.group === group);
		const { label, Icon } = commandGroupDisplays[group];

		return entries.length === 0 ? null : (
			<div key={group} className="flex flex-col gap-3">
				<h3 className="flex items-center gap-2 font-semibold text-muted-foreground-strong text-xs uppercase tracking-wider">
					<Icon aria-hidden="true" className="size-3.5" />
					{label}
				</h3>
				<ul className={listClass}>
					{entries.map((entry) => (
						<CommandRow key={entry.id} entry={entry} title={entry.cli ?? entry.id} headingLevel={4} />
					))}
				</ul>
			</div>
		);
	});

/**
 * Skills first, because they are what a reader with the plugin installed runs.
 * A command with both forms is listed once, as a skill; its page shows the CLI
 * form too.
 */
export const CommandsPage = () => {
	const { data: commands } = useSuspenseQuery(commandsQueryOptions());
	const skills = commands.filter((entry) => entry.slash !== undefined);
	const cli = commands.filter((entry) => entry.slash === undefined);

	return (
		<SitePageFrame>
			<header className="flex flex-col gap-5">
				<h1 className="font-extrabold text-4xl text-drop-navy tracking-tight md:text-5xl">Commands</h1>
				<p className="max-w-2xl text-lg text-muted-foreground leading-relaxed">
					Every command lightsout offers — what it does, when to reach for it, and what it leaves behind.
				</p>
			</header>
			<KindSection
				title="Skills"
				description="Run them in your coding harness once the lightsout plugin is installed. Shown as Claude Code and OMP name them; in Pi drop the lightsout: prefix, and in Codex ask for the skill by name."
				Icon={Sparkles}
			>
				<ul className={listClass}>
					{skills.map((entry) => (
						<CommandRow key={entry.id} entry={entry} title={entry.slash ?? entry.id} headingLevel={3} />
					))}
				</ul>
			</KindSection>
			<KindSection title="CLI" description="Run them in a terminal, in the repository you want them to act on." Icon={Terminal}>
				<div className="flex flex-col gap-8">
					<CliGroups commands={cli} />
				</div>
			</KindSection>
		</SitePageFrame>
	);
};
