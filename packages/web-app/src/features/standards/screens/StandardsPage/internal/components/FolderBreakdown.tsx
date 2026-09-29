import type { StandardsFinding } from '@lightsout/engine';
import { Button } from '#src/appUI/buttons/Button.tsx';
import { ShareBar } from '#src/appUI/ShareBar.tsx';
import { groupFindingsByFolder } from '#src/features/standards/common/utils/groupFindingsByFolder.ts';

/** The depths the dial offers. Three is where this repo's packages sit; four separates the folders inside one package's src. */
const depths = [3, 4];

interface Props {
	/** Findings after the rule filter, so the counts describe what the table is showing. */
	findings: StandardsFinding[];
	/** Folder-label depth. Held by the page rather than here, so the table can match a row against the same truncation. */
	depth: number;
	onDepthChange: (depth: number) => void;
	folderFilter?: string;
	onFolderFilterChange: (folder: string | undefined) => void;
}

export const FolderBreakdown = ({ findings, depth, onDepthChange, folderFilter, onFolderFilterChange }: Props) => {
	const groups = groupFindingsByFolder({ findings, depth });
	const largest = groups.length === 0 ? 0 : groups[0].count;

	return (
		<div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3">
			<div className="flex items-center gap-2 text-muted-foreground text-xs">
				<span>folder depth</span>
				{depths.map((option) => (
					<Button
						key={option}
						type="button"
						variant={option === depth ? 'outline' : 'ghost'}
						size="sm"
						aria-pressed={option === depth}
						onClick={() => onDepthChange(option)}
					>
						{option}
					</Button>
				))}
			</div>
			{groups.length === 0 ? (
				<p className="text-muted-foreground text-sm">No findings to place.</p>
			) : (
				<ul aria-label="Folders" className="flex flex-col gap-1">
					{groups.map((group) => (
						<li key={group.folder}>
							<button
								type="button"
								aria-pressed={folderFilter === group.folder}
								onClick={() => onFolderFilterChange(folderFilter === group.folder ? undefined : group.folder)}
								className="flex w-full flex-col gap-1 rounded-md px-2 py-1.5 text-left hover:bg-accent aria-pressed:bg-accent"
							>
								<span className="flex items-center justify-between gap-3 text-xs">
									<span className="min-w-0 truncate font-mono">{group.folder}</span>
									<span className="text-muted-foreground">{group.count}</span>
								</span>
								<ShareBar value={group.count} max={largest} />
							</button>
						</li>
					))}
				</ul>
			)}
		</div>
	);
};
