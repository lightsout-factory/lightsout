import { useSuspenseQuery } from '@tanstack/react-query';
import { CommandManual } from '#src/commands/CommandDetailScreen/CommandManual/CommandManual.tsx';
import { commandsQueryOptions } from '#src/commands/commandsQueryOptions.ts';
import { SitePageFrame } from '#src/common/site/SitePageFrame.tsx';

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
