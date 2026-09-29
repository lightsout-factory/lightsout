import type { RunListing } from '@lightsout/engine';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { MetadataTag } from '#src/appUI/badges/MetadataTag.tsx';
import { statusBadgeConfig } from '#src/common/constants/statusBadgeConfig.ts';
import { formatRelativeTime } from '#src/common/formatting/formatRelativeTime.ts';
import { repoRootQueryOptions } from '#src/features/app/queries/repoRootQueryOptions.ts';
import { configQueryOptions } from '#src/features/config/queries/configQueryOptions.ts';

const LastRun = ({ run }: { run: RunListing | undefined }) =>
	run === undefined ? (
		<span>no runs yet</span>
	) : (
		<span>
			last run {formatRelativeTime({ at: run.updatedAt })} · {statusBadgeConfig[run.status].label}
		</span>
	);

interface Props {
	/** Top-level runs only, newest first: a phase finishing is not the repo's last run, its coordinator is. */
	runs: RunListing[];
}

/** The config is subscribed to rather than suspended on: an unparseable config should cost two chips here, never the whole health page. */
export const RepoStrip = ({ runs }: Props) => {
	const {
		data: { repoRoot },
	} = useSuspenseQuery(repoRootQueryOptions());
	const { data: config, isError } = useQuery(configQueryOptions());
	// `null` means the file states neither; the chip is dropped rather than showing
	// the engine's fallback, which /app/config explains.
	const harness = config?.harness ?? undefined;
	const model = config?.model ?? undefined;

	return (
		// An inline element, not a block one: `PageHeader` renders its description
		// inside a paragraph, and a <div> there is invalid HTML that React warns
		// about and a browser would reparse.
		<span className="inline-flex flex-wrap items-center gap-x-3 gap-y-2">
			<MetadataTag className="min-w-0 truncate" title={repoRoot}>
				{repoRoot}
			</MetadataTag>
			{harness === undefined ? null : <MetadataTag>{harness}</MetadataTag>}
			{model === undefined ? null : <MetadataTag>{model}</MetadataTag>}
			{isError ? (
				<Link to="/app/config" className="underline underline-offset-4">
					config unreadable
				</Link>
			) : null}
			<LastRun run={runs[0]} />
		</span>
	);
};
