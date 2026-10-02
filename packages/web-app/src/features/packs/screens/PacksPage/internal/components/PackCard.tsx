import type { StandardsPackListing } from '@lightsout/engine';
import { Link } from '@tanstack/react-router';
import { ArrowRight, Blocks } from 'lucide-react';
import { CheckKind } from '#src/common/constants/CheckKind.ts';
import { checkKindIcons } from '#src/common/constants/checkKindIcons.ts';
import { checkKindLabels } from '#src/common/constants/checkKindLabels.ts';
import { checkKindTones } from '#src/common/constants/checkKindTones.ts';
import { cn } from '#src/common/utils/cn.ts';
import { PackCondition } from '#src/features/packs/components/PackCondition.tsx';

interface Props {
	/** The library the pack belongs to — the first half of its address and of its page link. */
	library: string;
	pack: StandardsPackListing;
}

export const PackCard = ({ library, pack }: Props) => {
	const kinds = [
		{ kind: CheckKind.Deterministic, count: pack.totals.checked },
		{ kind: CheckKind.Agent, count: pack.totals.judgment },
	];

	return (
		<Link
			to="/standards-packs/$library/packs/$pack"
			params={{ library, pack: pack.name }}
			className="group flex flex-col gap-6 rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary-tint-border hover:shadow-md"
		>
			<span className="flex size-11 items-center justify-center rounded-xl border border-border bg-muted/40">
				<Blocks aria-hidden="true" className="size-5 text-muted-foreground" />
			</span>
			<div className="flex flex-col gap-1">
				<h3 className="break-all font-bold font-mono text-drop-navy text-lg">{pack.address}</h3>
				{pack.description === undefined ? null : <p className="text-muted-foreground text-sm">{pack.description}</p>}
				{pack.appliesWhen === undefined ? null : <PackCondition dependencies={pack.appliesWhen.dependencies} className="text-xs" />}
				{pack.include.packs.length === 0 ? null : <p className="text-muted-foreground text-xs">Includes {pack.include.packs.join(', ')}</p>}
				<p className="text-muted-foreground text-sm">
					<span className="font-semibold text-drop-navy">{pack.totals.rules}</span> rules
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
