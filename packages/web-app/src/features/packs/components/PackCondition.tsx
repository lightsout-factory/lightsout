import { Fragment } from 'react';
import { cn } from '#src/common/utils/cn.ts';

/** What stands before the name at `index`: nothing, a comma, or the closing "or". */
const readSeparator = ({ index, count }: { index: number; count: number }) => {
	const middle = index === count - 1 ? ' or ' : ', ';

	return index === 0 ? '' : middle;
};

interface Props {
	/** The npm package names the pack's `applies-when` lists; a package declaring any one of them gets the pack. */
	dependencies: string[];
	className?: string;
}

/** Shown on a conditional pack only — a pack with no `applies-when` reaches every package and says nothing. */
export const PackCondition = ({ dependencies, className }: Props) => (
	<p className={cn('text-muted-foreground', className)}>
		Applies only to packages that depend on{' '}
		{dependencies.map((name, index) => (
			<Fragment key={name}>
				{readSeparator({ index, count: dependencies.length })}
				<code className="font-mono text-foreground">{name}</code>
			</Fragment>
		))}
		.
	</p>
);
