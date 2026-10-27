import { CommandGroup } from '@lightsout/engine/contracts';
import { useSuspenseQuery } from '@tanstack/react-query';
import { SitePageFrame } from '#src/appUI/SitePageFrame.tsx';
import { commandGroupDisplays } from '#src/features/commands/internal/common/constants/commandGroupDisplays.ts';
import { commandsQueryOptions } from '#src/features/commands/queries/commandsQueryOptions.ts';
import { CommandCard } from '#src/features/commands/screens/CommandsPage/internal/components/CommandCard.tsx';

const groupOrder = [CommandGroup.Build, CommandGroup.BurnDown, CommandGroup.Standards, CommandGroup.Housekeeping];

export const CommandsPage = () => {
	const { data: commands } = useSuspenseQuery(commandsQueryOptions());

	return (
		<SitePageFrame>
			<header className="flex flex-col gap-5">
				<h1 className="font-extrabold text-4xl text-drop-navy tracking-tight md:text-5xl">Commands</h1>
				<p className="max-w-2xl text-lg text-muted-foreground leading-relaxed">
					Every command lightsout offers — what it does, when to reach for it, and what it leaves behind.
				</p>
			</header>
			{groupOrder.map((group) => {
				const { label, description, Icon } = commandGroupDisplays[group];

				return (
					<section key={group} aria-label={label} className="flex flex-col gap-6">
						<div className="flex items-start gap-3">
							<span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-tint text-primary">
								<Icon aria-hidden="true" className="size-4" />
							</span>
							<div className="flex flex-col gap-1">
								<h2 className="font-bold text-2xl text-drop-navy">{label}</h2>
								<p className="text-muted-foreground text-sm">{description}</p>
							</div>
						</div>
						<div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
							{commands
								.filter((entry) => entry.group === group)
								.map((entry) => (
									<CommandCard key={entry.id} entry={entry} />
								))}
						</div>
					</section>
				);
			})}
		</SitePageFrame>
	);
};
