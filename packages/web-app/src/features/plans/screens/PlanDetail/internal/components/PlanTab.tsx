import type { PlanWorkspaceFile, PlanWorkspaceView } from '@lightsout/engine';
import { useState } from 'react';
import { MetadataTag } from '#src/appUI/badges/MetadataTag.tsx';
import { formatBytes } from '#src/features/plans/internal/common/utils/formatBytes.ts';
import { PlanDocumentBody } from '#src/features/plans/screens/PlanDetail/internal/components/PlanDocumentBody.tsx';

const FileLine = ({ file }: { file: PlanWorkspaceFile }) => (
	<li className="flex flex-wrap items-center gap-2 text-sm">
		<MetadataTag>{file.name}</MetadataTag>
		<span className="text-muted-foreground text-xs">{formatBytes({ bytes: file.bytes })}</span>
	</li>
);

const FileList = ({ title, files }: { title: string; files: PlanWorkspaceFile[] }) =>
	files.length === 0 ? null : (
		<section className="flex flex-col gap-1">
			<h3 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">{title}</h3>
			<ul className="flex flex-col gap-1">
				{files.map((file) => (
					<FileLine key={file.name} file={file} />
				))}
			</ul>
		</section>
	);

/** Fetched only once opened: rendering every phase with the tab would load far more markdown than a reader asked for. */
const PhaseFileRow = ({ file }: { file: PlanWorkspaceFile }) => {
	const [open, setOpen] = useState(false);

	return (
		<details className="rounded-lg border border-border bg-card px-4 py-3" onToggle={(event) => setOpen(event.currentTarget.open)}>
			<summary className="flex cursor-pointer flex-wrap items-center gap-2 text-sm">
				<MetadataTag>{file.name}</MetadataTag>
				<span className="text-muted-foreground text-xs">{formatBytes({ bytes: file.bytes })}</span>
			</summary>
			<div className="pt-3">{open ? <PlanDocumentBody path={file.path} /> : null}</div>
		</details>
	);
};

interface Props {
	view: PlanWorkspaceView;
}

export const PlanTab = ({ view }: Props) => (
	<div className="flex flex-col gap-4">
		{view.planFile === undefined ? (
			<p className="text-muted-foreground text-sm">No plan drafted yet — run lightsout plan draft --name {view.listing.name}.</p>
		) : (
			<PlanDocumentBody path={view.planFile.path} />
		)}
		{view.phaseFiles.length === 0 ? null : (
			<section className="flex flex-col gap-2">
				<h3 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">Phases</h3>
				{view.phaseFiles.map((file) => (
					<PhaseFileRow key={file.name} file={file} />
				))}
			</section>
		)}
		<FileList title="Archived" files={view.listing.implementedFiles} />
		<FileList title="Transcripts" files={view.transcripts} />
	</div>
);
