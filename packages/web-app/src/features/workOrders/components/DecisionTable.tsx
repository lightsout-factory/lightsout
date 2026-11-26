import type { DecisionRow } from '@lightsout/engine/contracts';
import { MetadataTag } from '#src/components/ui/MetadataTag.tsx';

interface Props {
	rows: DecisionRow[];
}

const cellClass = 'px-4 py-3 align-top leading-6';

const headerClass = 'whitespace-nowrap px-4 py-2.5 font-semibold text-muted-foreground-strong text-xs uppercase tracking-wide';

/** A choice made without a person confirming it is tagged, so a reader can tell a settled answer from a guess. */
export const DecisionTable = ({ rows }: Props) => (
	<div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
		<table className="w-full border-collapse text-left text-sm">
			<thead className="bg-muted/50">
				<tr>
					<th className={headerClass}>Question</th>
					<th className={headerClass}>Choice</th>
					<th className={headerClass}>Rationale</th>
				</tr>
			</thead>
			<tbody>
				{rows.map((row) => (
					<tr key={`${row.source}-${row.question}`} className="border-border border-t">
						<td className={cellClass}>{row.question}</td>
						<td className={cellClass}>
							<span className="flex flex-wrap items-center gap-2">
								{row.choice}
								{row.assumption ? <MetadataTag>Assumption</MetadataTag> : null}
							</span>
						</td>
						<td className={cellClass}>{row.rationale}</td>
					</tr>
				))}
			</tbody>
		</table>
	</div>
);
