import type { StandardsPackRuleView } from '@lightsout/engine';
import { CodeSpans } from '#src/components/markdown/CodeSpans.tsx';
import { severityDisplays } from '#src/constants/severityDisplays.ts';
import { CheckKindTag } from '#src/features/packs/components/CheckKindTag.tsx';
import { toCheckKinds } from '#src/features/packs/utils/toCheckKinds.ts';
import { cn } from '#src/utils/cn.ts';

interface Props {
	rule: StandardsPackRuleView;
}

/** Shows the pack's defaults, not any repo's setting: a repo's config belongs on the page about that repo. */
export const RuleHeader = ({ rule }: Props) => {
	const severity = severityDisplays[rule.defaultSeverity];

	return (
		<header className="flex flex-col gap-4">
			<h1 className="break-words font-bold font-mono text-2xl text-drop-navy md:text-3xl">{rule.id}</h1>
			<p className="text-lg text-muted-foreground leading-relaxed">
				<CodeSpans text={rule.summary} />
			</p>
			<div className="flex flex-wrap items-center gap-2">
				{toCheckKinds({ deterministic: rule.deterministic, agent: rule.agent }).map((kind) => (
					<CheckKindTag key={kind} kind={kind} />
				))}
				<span className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 font-semibold text-muted-foreground-strong text-xs">
					<severity.Icon aria-hidden="true" className={cn('size-3.5', severity.iconClass)} />
					{severity.verb} by default
				</span>
			</div>
		</header>
	);
};
