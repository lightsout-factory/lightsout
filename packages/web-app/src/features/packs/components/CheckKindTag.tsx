import type { CheckKind } from '#src/common/constants/CheckKind.ts';
import { checkKindIcons } from '#src/common/constants/checkKindIcons.ts';
import { checkKindLabels } from '#src/common/constants/checkKindLabels.ts';
import { checkKindTones } from '#src/common/constants/checkKindTones.ts';
import { cn } from '#src/common/utils/cn.ts';

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
