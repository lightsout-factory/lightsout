import { CommandActor, type CommandActor as CommandActorValue, type CommandStep } from '@lightsout/engine/contracts';
import { Bot, Cog, type LucideIcon, UserRound } from 'lucide-react';
import { MetadataTag } from '#src/appUI/badges/MetadataTag.tsx';
import { CodeSpans } from '#src/appUI/CodeSpans.tsx';
import { CheckKind } from '#src/common/constants/CheckKind.ts';
import { checkKindTones } from '#src/common/constants/checkKindTones.ts';
import { cn } from '#src/common/utils/cn.ts';

/** Engine steps take the deterministic tone and agent steps the agent tone, so the timeline reads the same colours as the Standards Packs key. */
const actorDisplays: Record<CommandActorValue, { Icon: LucideIcon; tone: string }> = {
	[CommandActor.Engine]: { Icon: Cog, tone: checkKindTones[CheckKind.Deterministic] },
	[CommandActor.Agent]: { Icon: Bot, tone: checkKindTones[CheckKind.Agent] },
	[CommandActor.You]: { Icon: UserRound, tone: 'bg-muted text-muted-foreground-strong' },
};

/** The catalog writes the label in the infographic's capitals; here it reads as a sentence. */
const toSavedLabel = ({ savedLabel }: { savedLabel: string | undefined }) => {
	const label = (savedLabel ?? 'Files written').toLowerCase();

	return `${label.charAt(0).toUpperCase()}${label.slice(1)}`;
};

interface Props {
	steps: CommandStep[];
}

export const CommandSteps = ({ steps }: Props) => (
	<ol className="flex flex-col">
		{steps.map((step, index) => {
			const { Icon, tone } = actorDisplays[step.actor];

			return (
				<li key={step.title} className="relative flex gap-4 pb-8 last:pb-0">
					{index === steps.length - 1 ? null : <span aria-hidden="true" className="absolute top-9 bottom-0 left-[17px] w-px bg-border" />}
					<span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-card font-bold text-drop-navy text-sm">
						{index + 1}
					</span>
					<div className="flex min-w-0 flex-col gap-2 pt-1.5">
						<div className="flex flex-wrap items-center gap-2">
							<h3 className="font-bold text-drop-navy text-sm tracking-wide">{step.title}</h3>
							<span className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-semibold text-xs', tone)}>
								<Icon aria-hidden="true" className="size-3" />
								{step.actor}
							</span>
						</div>
						<ul className="list-disc space-y-1 pl-5 text-muted-foreground-strong text-sm">
							{step.bullets.map((bullet) => (
								<li key={bullet}>
									<CodeSpans text={bullet} />
								</li>
							))}
						</ul>
						{step.note === undefined ? null : <p className="text-muted-foreground text-sm italic">{step.note}</p>}
						{step.saved.length === 0 ? null : (
							<details className="text-muted-foreground text-xs">
								<summary className="cursor-pointer select-none hover:text-foreground">{toSavedLabel({ savedLabel: step.savedLabel })}</summary>
								<div className="mt-2 flex flex-wrap gap-1">
									{step.saved.map((path) => (
										<MetadataTag key={path}>{path}</MetadataTag>
									))}
								</div>
							</details>
						)}
					</div>
				</li>
			);
		})}
	</ol>
);
