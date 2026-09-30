import type { StandardsPackRuleListing } from '@lightsout/engine';
import type { StandardsSeverity } from '@lightsout/engine/contracts';
import { Link } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';
import { severityDisplays } from '#src/common/constants/severityDisplays.ts';
import { cn } from '#src/common/utils/cn.ts';
import { toCheckKind } from '#src/common/utils/toCheckKind.ts';
import { CheckKindTag } from '#src/features/packs/components/CheckKindTag.tsx';
import { CodeSpans } from '#src/features/packs/components/CodeSpans.tsx';

interface Props {
	rule: StandardsPackRuleListing;
	/** The library the rule belongs to — the first segment of its page address. */
	library: string;
	/** The severity the pack settles on for the rule, which may differ from the rule's own default. */
	severity: StandardsSeverity;
}

export const RuleRow = ({ rule, library, severity }: Props) => {
	const display = severityDisplays[severity];

	return (
		<li>
			<Link
				to="/standards-packs/$library/rules/$rule"
				params={{ library, rule: rule.id }}
				className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/40"
			>
				<div className="flex min-w-0 flex-1 flex-col gap-1">
					<span className="truncate font-mono font-semibold text-drop-navy text-sm">{rule.id}</span>
					<span className="text-muted-foreground text-sm">
						<CodeSpans text={rule.summary} />
					</span>
				</div>
				<div className="hidden shrink-0 items-center gap-2 sm:flex">
					<CheckKindTag kind={toCheckKind({ checked: rule.checked })} isShort />
					<span className="inline-flex w-20 items-center gap-1.5 font-medium text-muted-foreground text-xs">
						<display.Icon aria-hidden="true" className={cn('size-3.5', display.iconClass)} />
						{display.verb}
					</span>
				</div>
				<ChevronRight aria-hidden="true" className="size-4 shrink-0 text-subtle-foreground transition-transform group-hover:translate-x-0.5" />
			</Link>
		</li>
	);
};
