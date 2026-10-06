import { Card } from '#src/appUI/panels/Card.tsx';
import { groupBy } from '#src/features/runDetail/screens/RunDetail/internal/components/common/utils/groupBy.ts';

/** The package, then the area within it: the blast radius a reader reads first. */
const toFolder = ({ path }: { path: string }) => path.split('/').slice(0, 2).join('/');

interface Props {
	files: string[];
}

export const ChangedFilesPanel = ({ files }: Props) => (
	<Card title={`Changed files · ${files.length}`}>
		{files.length === 0 ? (
			<p className="text-muted-foreground text-sm">This run changed nothing.</p>
		) : (
			<div className="flex flex-col gap-4">
				{groupBy({ items: files, getKey: (path) => toFolder({ path }) }).map(([folder, paths]) => (
					<div key={folder} className="flex flex-col gap-1">
						<span className="font-medium font-mono text-sm">{folder}</span>
						<ul className="flex flex-col gap-0.5 pl-3 font-mono text-muted-foreground text-xs">
							{paths.map((path) => (
								<li key={path}>{path}</li>
							))}
						</ul>
					</div>
				))}
			</div>
		)}
	</Card>
);
