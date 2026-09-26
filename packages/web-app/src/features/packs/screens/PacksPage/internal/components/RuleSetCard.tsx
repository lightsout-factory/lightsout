import type { StandardsPackListing } from '@lightsout/engine';
import { Link } from '@tanstack/react-router';
import { ArrowRight, Blocks } from 'lucide-react';
import { FrameworkMark } from '#src/appUI/icons/FrameworkMark.tsx';
import { CheckKind } from '#src/common/constants/CheckKind.ts';
import { checkKindIcons } from '#src/common/constants/checkKindIcons.ts';
import { checkKindLabels } from '#src/common/constants/checkKindLabels.ts';
import { checkKindTones } from '#src/common/constants/checkKindTones.ts';
import { cn } from '#src/common/utils/cn.ts';
import { describeChannel } from '#src/features/packs/internal/common/utils/describeChannel.ts';
import { toRuleSetSlug } from '#src/features/packs/internal/common/utils/toRuleSetSlug.ts';

type ChannelTotal = StandardsPackListing['channelTotals'][number];

interface Props {
	total: ChannelTotal;
}

/**
 * One set of rules in a pack — TypeScript, React, TanStack — as a card that
 * opens those rules: its logo, when it applies, how many rules it holds, and
 * how many are deterministic checks and how many agent checks, each beside the
 * icon the page's key gives that kind. A kind the set has none of is dimmed.
 */
export const RuleSetCard = ({ total }: Props) => {
	const face = describeChannel({ channel: total.channel });
	const kinds = [
		{ kind: CheckKind.Deterministic, count: total.checked },
		{ kind: CheckKind.Agent, count: total.judgment },
	];

	return (
		<Link
			to="/standards-packs/$ruleSet"
			params={{ ruleSet: toRuleSetSlug({ channel: total.channel }) }}
			className="group flex flex-col gap-6 rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary-tint-border hover:shadow-md"
		>
			<div className="flex items-start justify-between gap-3">
				<span className="flex size-11 items-center justify-center rounded-xl border border-border bg-muted/40">
					{face.framework === undefined ? (
						<Blocks aria-hidden="true" className="size-5 text-muted-foreground" />
					) : (
						<FrameworkMark framework={face.framework} className="size-6" />
					)}
				</span>
				<span className="rounded-full bg-muted px-2.5 py-1 font-semibold text-muted-foreground text-xs">{face.activation}</span>
			</div>
			<div className="flex flex-col gap-1">
				<h3 className="font-bold text-drop-navy text-xl">{face.name}</h3>
				<p className="text-muted-foreground text-sm">
					<span className="font-semibold text-drop-navy">{total.rules}</span> rules
				</p>
			</div>
			<ul className="flex flex-col gap-2">
				{kinds.map(({ kind, count }) => {
					const Icon = checkKindIcons[kind];

					return (
						<li key={kind} className={cn('flex items-center gap-2.5 text-muted-foreground-strong text-sm', count === 0 && 'opacity-50')}>
							<span className={cn('flex size-6 shrink-0 items-center justify-center rounded-md', checkKindTones[kind])}>
								<Icon aria-hidden="true" className="size-3.5" />
							</span>
							{count} {checkKindLabels[kind].plural}
						</li>
					);
				})}
			</ul>
			<span className="mt-auto inline-flex items-center gap-1 font-semibold text-primary text-sm">
				View rules
				<ArrowRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-0.5" />
			</span>
		</Link>
	);
};
