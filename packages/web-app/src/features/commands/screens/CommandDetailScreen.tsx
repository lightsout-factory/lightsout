import { useSuspenseQuery } from '@tanstack/react-query';
import { SitePageFrame } from '#src/components/site/SitePageFrame.tsx';
import { CommandManual } from '#src/features/commands/components/CommandManual/CommandManual.tsx';
import { commandsQueryOptions } from '#src/features/commands/queries/commandsQueryOptions.ts';

interface Props {
	commandId: string;
}

/** An unknown id renders nothing: the route answers it with its own not-found panel before this is reached. */
export const CommandDetailScreen = ({ commandId }: Props) => {
	const { data: commands } = useSuspenseQuery(commandsQueryOptions());
	const entry = commands.find((candidate) => candidate.id === commandId);

	return entry === undefined ? null : (
		<SitePageFrame crumbs={[{ label: 'Commands', link: { to: '/commands' } }, { label: entry.id }]}>
			<CommandManual entry={entry} />
		</SitePageFrame>
	);
};
