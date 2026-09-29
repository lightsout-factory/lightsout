import { Link } from '@tanstack/react-router';
import { Blocks } from 'lucide-react';
import { FrameworkMark } from '#src/appUI/icons/FrameworkMark.tsx';
import { CheckKind } from '#src/common/constants/CheckKind.ts';
import { checkKindLabels } from '#src/common/constants/checkKindLabels.ts';
import { baseRuleSetSlug } from '#src/features/packs/internal/common/constants/baseRuleSetSlug.ts';
import { describeChannel } from '#src/features/packs/internal/common/utils/describeChannel.ts';

interface Props {
	channel: string;
	totals: { rules: number } & Record<CheckKind, number>;
}

export const RuleSetHeader = ({ channel, totals }: Props) => {
	const face = describeChannel({ channel });
	const figures = [
		{ label: 'Rules', value: totals.rules },
		...Object.values(CheckKind).map((kind) => ({ label: `${checkKindLabels[kind].label}s`, value: totals[kind] })),
	];

	return (
		<header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
			<div className="flex items-center gap-5">
				<span className="flex size-16 shrink-0 items-center justify-center rounded-2xl border border-border bg-card shadow-sm">
					{face.framework === undefined ? (
						<Blocks aria-hidden="true" className="size-7 text-muted-foreground" />
					) : (
						<FrameworkMark framework={face.framework} className="size-8" />
					)}
				</span>
				<div className="flex flex-col gap-2">
					<div className="flex flex-wrap items-center gap-3">
						<h1 className="font-extrabold text-4xl text-drop-navy tracking-tight">{face.name}</h1>
						<span className="rounded-full bg-muted px-2.5 py-1 font-semibold text-muted-foreground text-xs">{face.activation}</span>
					</div>
					{channel === 'base' ? (
						<p className="text-muted-foreground">The rules every repo gets: architecture, style, documentation and unit testing.</p>
					) : (
						<p className="text-muted-foreground">
							Added on top of the{' '}
							<Link to="/standards-packs/$ruleSet" params={{ ruleSet: baseRuleSetSlug }} className="font-semibold text-primary hover:text-primary-hover">
								TypeScript rules
							</Link>{' '}
							when a repo uses {face.name}.
						</p>
					)}
				</div>
			</div>
			<dl className="flex gap-8">
				{figures.map((figure) => (
					<div key={figure.label} className="flex flex-col-reverse gap-1">
						<dt className="font-semibold text-[11px] text-subtle-foreground uppercase tracking-widest">{figure.label}</dt>
						<dd className="font-bold text-2xl text-drop-navy">{figure.value}</dd>
					</div>
				))}
			</dl>
		</header>
	);
};
