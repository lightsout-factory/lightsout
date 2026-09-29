import { CommandGroup } from '@lightsout/engine/contracts';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Terminal } from 'lucide-react';
import { PageHeader } from '#src/appUI/headers/PageHeader.tsx';
import { SectionHeader } from '#src/appUI/headers/SectionHeader.tsx';
import { commandGroupLabels } from '#src/features/commands/internal/common/constants/commandGroupLabels.ts';
import { commandsQueryOptions } from '#src/features/commands/queries/commandsQueryOptions.ts';
import { CommandCard } from '#src/features/commands/screens/CommandsPage/internal/components/CommandCard.tsx';

const groupOrder = [CommandGroup.Build, CommandGroup.BurnDown, CommandGroup.Standards, CommandGroup.Housekeeping];

export const CommandsPage = () => {
	const { data: commands } = useSuspenseQuery(commandsQueryOptions());

	return (
		<div className="flex flex-col gap-8 p-6">
			<PageHeader
				icon={Terminal}
				title="Commands"
				description="Every command lightsout offers — what it does, when to reach for it, and what it leaves behind."
			/>
			{groupOrder.map((group) => (
				<section key={group} className="flex flex-col gap-4">
					<SectionHeader title={commandGroupLabels[group]} />
					<div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
						{commands
							.filter((entry) => entry.group === group)
							.map((entry) => (
								<CommandCard key={entry.id} entry={entry} />
							))}
					</div>
				</section>
			))}
		</div>
	);
};
