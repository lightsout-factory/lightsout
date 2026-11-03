import type { CheckKind } from '#src/constants/CheckKind.ts';
import { checkKindIcons } from '#src/constants/checkKindIcons.ts';
import { checkKindLabels } from '#src/constants/checkKindLabels.ts';
import { checkKindTones } from '#src/constants/checkKindTones.ts';
import { cn } from '#src/utils/cn.ts';

interface Props {
	kind: CheckKind;
	isShort?: boolean;
}

export const CheckKindTag = ({ kind, isShort = false }: Props) => {
	const Icon = checkKindIcons[kind];

	return (
		<span className={cn('inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-semibold text-xs', checkKindTones[kind])}>
			<Icon aria-hidden="true" className="size-3.5" />
			{isShort ? checkKindLabels[kind].short : checkKindLabels[kind].label}
		</span>
	);
};
