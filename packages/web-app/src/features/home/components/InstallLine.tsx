import { CopyButton } from '#src/appUI/buttons/CopyButton.tsx';
import { cn } from '#src/common/utils/cn.ts';

/** Split so the command word can be coloured apart from its argument. */
const installCommand = { name: '/plugin', rest: 'marketplace add lightsout-factory/lightsout' };

const installText = `${installCommand.name} ${installCommand.rest}`;

interface Props {
	className?: string;
}

export const InstallLine = ({ className }: Props) => (
	<div className={cn('flex h-14 min-w-0 items-center gap-4 rounded-full border border-border bg-card pr-2 pl-6 shadow-lg', className)}>
		<code className="min-w-0 flex-1 truncate text-left font-mono text-base text-foreground">
			<span className="text-primary">{installCommand.name}</span> {installCommand.rest}
		</code>
		<CopyButton
			value={installText}
			label="Copy install command"
			isLabelHidden
			className="size-10 rounded-full bg-primary text-primary-foreground hover:bg-primary-hover hover:text-primary-foreground"
		/>
	</div>
);
