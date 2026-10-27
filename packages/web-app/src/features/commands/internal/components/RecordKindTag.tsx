import type { CommandRecordKind } from '@lightsout/engine/contracts';
import { recordKindDisplays } from '#src/features/commands/internal/common/constants/recordKindDisplays.ts';

interface Props {
	records: CommandRecordKind;
}

/** Nothing for a command that leaves nothing behind. */
export const RecordKindTag = ({ records }: Props) => {
	const display = recordKindDisplays[records];

	return display === undefined ? null : (
		<span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 font-semibold text-muted-foreground-strong text-xs">
			<display.Icon aria-hidden="true" className="size-3.5" />
			{display.label}
		</span>
	);
};
