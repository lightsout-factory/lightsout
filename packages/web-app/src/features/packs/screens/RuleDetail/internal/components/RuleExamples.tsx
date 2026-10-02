import { FixtureSide, type RuleExample, RuleExampleKind, type StandardsPackFixture } from '@lightsout/engine/contracts';
import { CircleCheck, CircleX, type LucideIcon } from 'lucide-react';
import { CodeBlock } from '#src/appUI/CodeBlock.tsx';
import { FileTree } from '#src/appUI/FileTree.tsx';
import { Tabs } from '#src/appUI/Tabs.tsx';
import { CheckKind } from '#src/common/constants/CheckKind.ts';
import { cn } from '#src/common/utils/cn.ts';

/** Incorrect comes first: it is what the rule is about. */
const sides: Array<{ side: FixtureSide; title: string; Icon: LucideIcon; iconClass: string }> = [
	{ side: FixtureSide.Fail, title: 'Incorrect', Icon: CircleX, iconClass: 'text-status-failed' },
	{ side: FixtureSide.Pass, title: 'Correct', Icon: CircleCheck, iconClass: 'text-status-passed' },
];

const sources: Record<CheckKind, string> = {
	[CheckKind.Deterministic]: 'The check flags the incorrect code and passes the correct code.',
	[CheckKind.Agent]: 'The agent flags code like the incorrect example and accepts code like the correct one.',
	[CheckKind.Both]: 'The check flags the incorrect code and passes the correct code; the agent judges what the check cannot see.',
};

const SideFiles = ({ files, example, side, title }: { files: StandardsPackFixture[]; example: RuleExample; side: FixtureSide; title: string }) => {
	if (example.kind === RuleExampleKind.Repo) {
		return (
			<FileTree
				label={`${title} files`}
				defaultPath={example.focus[side]}
				files={files.map((file) => ({ path: file.path, content: <CodeBlock text={file.text} path={file.path} className="rounded-none border-0" /> }))}
			/>
		);
	}

	return files.length === 1 ? (
		<CodeBlock text={files[0].text} path={files[0].path} />
	) : (
		<Tabs
			items={files.map((file) => ({
				value: file.path,
				label: <span className="font-mono text-xs">{file.path}</span>,
				content: <CodeBlock text={file.text} path={file.path} isCaptionHidden />,
			}))}
		/>
	);
};

interface Props {
	fixtures: StandardsPackFixture[];
	kind: CheckKind;
	example: RuleExample;
}

export const RuleExamples = ({ fixtures, kind, example }: Props) =>
	fixtures.length === 0 ? (
		<p className="text-muted-foreground text-sm">This pack shipped without its examples.</p>
	) : (
		<div className="flex flex-col gap-8">
			<p className="text-muted-foreground text-sm">
				{sources[kind]}
				{/* Said once above a repo's two trees, so the extra files read as the setting the rule needs rather than as more examples. */}
				{example.kind === RuleExampleKind.Repo
					? ' Each example is a small repo, because this rule looks across files. It opens on the file that matters; the other files are the repo around it.'
					: null}
			</p>
			{sides.map(({ side, title, Icon, iconClass }) => {
				const files = fixtures.filter((fixture) => fixture.side === side);

				return files.length === 0 ? null : (
					<div key={side} className="flex flex-col gap-3">
						<h3 className="flex items-center gap-2 font-semibold text-drop-navy text-sm">
							<Icon aria-hidden="true" className={cn('size-4', iconClass)} />
							{title}
						</h3>
						<SideFiles files={files} example={example} side={side} title={title} />
					</div>
				);
			})}
		</div>
	);
