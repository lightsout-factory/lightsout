import type { StandardsPackRuleView } from '@lightsout/engine';
import { StandardsSeverity } from '@lightsout/engine/contracts';
import { CopyButton } from '#src/appUI/buttons/CopyButton.tsx';
import { CodeBlock } from '#src/appUI/CodeBlock.tsx';
import { severityDisplays } from '#src/common/constants/severityDisplays.ts';
import { cn } from '#src/common/utils/cn.ts';

/** Written at the pack's defaults so pasting it changes nothing until a value is edited. */
const buildConfigSnippet = ({ rule }: { rule: StandardsPackRuleView }) =>
	JSON.stringify(
		{
			'standards-checks': {
				[rule.id]: Object.keys(rule.defaultSettings).length === 0 ? rule.defaultSeverity : { severity: rule.defaultSeverity, settings: rule.defaultSettings },
			},
		},
		null,
		'\t',
	);

interface Props {
	rule: StandardsPackRuleView;
}

export const RuleConfiguration = ({ rule }: Props) => {
	const snippet = buildConfigSnippet({ rule });

	return (
		<div className="flex flex-col gap-6">
			<ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
				{Object.values(StandardsSeverity).map((severity) => {
					const { label, meaning, Icon, iconClass } = severityDisplays[severity];
					const isDefault = severity === rule.defaultSeverity;

					return (
						<li key={severity} className="flex items-start gap-3 px-4 py-3">
							<Icon aria-hidden="true" className={cn('mt-0.5 size-4 shrink-0', iconClass)} />
							<div className="flex min-w-0 flex-1 flex-col gap-0.5">
								<span className="flex items-center gap-2 font-semibold text-drop-navy text-sm">
									{label}
									<code className="font-mono font-normal text-muted-foreground text-xs">"{severity}"</code>
								</span>
								<span className="text-muted-foreground text-sm">{meaning}</span>
							</div>
							{isDefault ? <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 font-semibold text-muted-foreground-strong text-xs">Default</span> : null}
						</li>
					);
				})}
			</ul>
			<div className="flex flex-col gap-3">
				<p className="text-muted-foreground text-sm">Add this to your lightsout.config.json, then change the value.</p>
				<CodeBlock text={snippet} path="lightsout.config.json" action={<CopyButton value={snippet} label="Copy" />} />
			</div>
		</div>
	);
};
