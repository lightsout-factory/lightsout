import type { StandardsPackView } from '@lightsout/engine';
import { CheckKind } from '#src/common/constants/CheckKind.ts';
import { checkKindIcons } from '#src/common/constants/checkKindIcons.ts';
import { checkKindLabels } from '#src/common/constants/checkKindLabels.ts';

interface Props {
	/** The library lightsout ships; left out until it answers. */
	library?: StandardsPackView;
}

export const PackStats = ({ library }: Props) => {
	const kinds = [
		{ Icon: checkKindIcons[CheckKind.Deterministic], count: library?.totals.checked, label: checkKindLabels[CheckKind.Deterministic].plural },
		{ Icon: checkKindIcons[CheckKind.Agent], count: library?.totals.judgment, label: checkKindLabels[CheckKind.Agent].plural },
	];

	return (
		<div className="flex flex-col gap-5">
			{library === undefined ? null : (
				<p className="font-extrabold text-4xl text-drop-navy tracking-tight">
					{library.totals.rules} <span className="font-semibold text-base text-muted-foreground tracking-normal">rules in the lightsout library</span>
				</p>
			)}
			<ul className="flex flex-col gap-3">
				{kinds.map(({ Icon, count, label }) => (
					<li key={label} className="flex items-center gap-3 text-muted-foreground-strong text-sm">
						<span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-tint text-primary">
							<Icon aria-hidden="true" className="size-4" />
						</span>
						<span>
							{count === undefined ? null : <span className="font-bold text-drop-navy">{count} </span>}
							{count === undefined ? `${label.charAt(0).toUpperCase()}${label.slice(1)}` : label}
						</span>
					</li>
				))}
			</ul>
		</div>
	);
};
