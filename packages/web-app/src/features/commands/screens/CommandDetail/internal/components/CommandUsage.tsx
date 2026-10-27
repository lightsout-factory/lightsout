import { spellFlag } from '@lightsout/engine/commands';
import type { CommandCatalogEntry } from '@lightsout/engine/contracts';
import { CopyButton } from '#src/appUI/buttons/CopyButton.tsx';
import { CodeSpans } from '#src/appUI/CodeSpans.tsx';
import { buildUsageLine } from '#src/features/commands/internal/common/utils/buildUsageLine.ts';

interface Props {
	entry: CommandCatalogEntry;
}

/**
 * Deliberately not the bracketed one-liner `lightsout --help` prints:
 * re-deriving the usage line's rules here would be a second list the catalog
 * exists to prevent. Each shape is a line to paste; every flag is listed below.
 */
export const CommandUsage = ({ entry }: Props) => (
	<div className="flex flex-col gap-6">
		<ul className="flex flex-col gap-3">
			{entry.invocations.map((invocation) => {
				const line = buildUsageLine({ entry, invocation });

				return (
					<li key={invocation.id} className="flex flex-col gap-1.5">
						<div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 py-1.5 pr-1.5 pl-4">
							<code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-drop-navy text-sm">{line}</code>
							<CopyButton value={line} label={`Copy ${line}`} isLabelHidden />
						</div>
						{invocation.note === undefined ? null : (
							<span className="pl-1 text-muted-foreground text-xs">
								<CodeSpans text={invocation.note} />
							</span>
						)}
					</li>
				);
			})}
		</ul>
		{entry.flags.length === 0 ? null : (
			<dl aria-label="Flags" className="flex flex-col divide-y divide-border rounded-lg border border-border">
				{entry.flags.map((flag) => (
					<div key={`${flag.name}:${flag.shape ?? 'any'}`} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:gap-6">
						<dt className="shrink-0 font-mono font-semibold text-drop-navy text-sm sm:w-48">{spellFlag({ flag })}</dt>
						<dd className="flex min-w-0 flex-col gap-0.5 text-sm">
							<span className="break-words">
								<CodeSpans text={flag.meaning} />
							</span>
							<span className="text-muted-foreground text-xs">{flag.required ? 'Required' : <CodeSpans text={`Left out: ${flag.fallback ?? 'off'}`} />}</span>
						</dd>
					</div>
				))}
			</dl>
		)}
	</div>
);
