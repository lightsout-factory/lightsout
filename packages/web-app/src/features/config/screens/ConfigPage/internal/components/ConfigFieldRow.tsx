import type { ConfigFieldView } from '@lightsout/engine';
import { Badge } from '#src/appUI/badges/Badge.tsx';
import { MetadataTag } from '#src/appUI/badges/MetadataTag.tsx';
import { BadgeVariant } from '#src/common/constants/BadgeVariant.ts';

/**
 * A null is never "the config said null": the contract uses it for a key with
 * no named default, and a literal `null` would read as a setting somebody chose.
 */
const FieldValue = ({ value }: { value: ConfigFieldView['value'] }) => {
	if (value === null) {
		return <span className="text-muted-foreground text-xs">default: none</span>;
	}

	return typeof value === 'object' ? (
		<pre className="min-w-0 overflow-x-auto rounded-md bg-muted px-2 py-1 font-mono text-muted-foreground-strong text-xs">
			{JSON.stringify(value, null, '\t')}
		</pre>
	) : (
		<code className="rounded-md bg-muted px-2 py-1 font-mono text-xs">{JSON.stringify(value)}</code>
	);
};

interface Props {
	field: ConfigFieldView;
}

export const ConfigFieldRow = ({ field }: Props) => (
	<div className="flex flex-col gap-1.5 border-border border-b py-3 last:border-0 last:pb-0 first:pt-0">
		<div className="flex flex-wrap items-center gap-2">
			<MetadataTag>{field.key}</MetadataTag>
			<Badge variant={field.fromConfig ? BadgeVariant.Running : BadgeVariant.Neutral}>{field.fromConfig ? 'from config' : 'default'}</Badge>
		</div>
		<FieldValue value={field.value} />
		<p className="text-muted-foreground text-xs leading-5">{field.description}</p>
	</div>
);
