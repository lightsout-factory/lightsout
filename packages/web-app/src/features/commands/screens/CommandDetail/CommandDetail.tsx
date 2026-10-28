import { useSuspenseQuery } from '@tanstack/react-query';
import { SitePageFrame } from '#src/appUI/SitePageFrame.tsx';
import { commandsQueryOptions } from '#src/features/commands/queries/commandsQueryOptions.ts';
import { CommandManual } from '#src/features/commands/screens/CommandDetail/internal/components/CommandManual.tsx';

interface Props {
	commandId: string;
}

/** An unknown id renders nothing: the route answers it with its own not-found panel before this is reached. */
export const CommandDetail = ({ commandId }: Props) => {
	const { data: commands } = useSuspenseQuery(commandsQueryOptions());
	const entry = commands.find((candidate) => candidate.id === commandId);

	return entry === undefined ? null : (
		<SitePageFrame crumbs={[{ label: 'Commands', link: { to: '/commands' } }, { label: entry.id }]}>
			<CommandManual entry={entry} />
		</SitePageFrame>
	);
};
