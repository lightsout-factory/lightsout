import type { PlanFacts } from '@lightsout/engine/contracts';
import { SiteSection } from '#src/components/site/SiteSection.tsx';
import { formatLocalTime } from '#src/utils/formatLocalTime.ts';

type Area = PlanFacts['areas'][number];

const noteClass = 'text-muted-foreground text-sm';

const cellClass = 'px-4 py-2.5 align-top leading-6';

const headerClass = 'whitespace-nowrap px-4 py-2.5 font-semibold text-muted-foreground-strong text-xs uppercase tracking-wide';

interface FactRow {
	/** The path, symbol or script the row is about; drawn in the code face. */
	name: string;
	detail: string;
	/** Where an integration point lives; absent on every other kind of row. */
	at?: string;
}

/** One kind of fact as a table, left out entirely when the area recorded none of that kind. */
const FactTable = ({ label, rows }: { label: string; rows: FactRow[] }) =>
	rows.length === 0 ? null : (
		<div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
			<table className="w-full border-collapse text-left text-sm">
				<thead className="bg-muted/50">
					<tr>
						<th className={headerClass} colSpan={2}>
							{label}
						</th>
					</tr>
				</thead>
				<tbody>
					{rows.map((row) => (
						<tr key={`${row.name}-${row.at}-${row.detail}`} className="border-border border-t">
							<td className={`${cellClass} break-all font-mono text-xs md:w-2/5`}>
								{row.name}
								{row.at === undefined ? null : <span className="block text-muted-foreground">{row.at}</span>}
							</td>
							<td className={cellClass}>{row.detail}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);

const AreaSection = ({ area }: { area: Area }) => (
	<SiteSection title={area.area}>
		{area.affectedPackages.length === 0 ? null : <p className="font-mono text-muted-foreground text-xs">{area.affectedPackages.join(' · ')}</p>}
		<p className="text-sm leading-6">{area.namingConvention}</p>
		<FactTable label="Files to modify" rows={area.filesToModify.map((file) => ({ name: file.path, detail: file.role }))} />
		<FactTable label="Patterns to mirror" rows={area.patternsToMirror.map((pattern) => ({ name: pattern.path, detail: pattern.takeaway }))} />
		<FactTable label="Integration points" rows={area.integrationPoints.map((point) => ({ name: point.name, detail: point.signature, at: point.at }))} />
		<FactTable label="Scripts" rows={area.scripts.map((script) => ({ name: script.key, detail: script.command }))} />
	</SiteSection>
);

/** A path or script the check could not find is named, because a fact resting on it is not a fact. */
const MissingList = ({ label, names }: { label: string; names: string[] }) =>
	names.length === 0 ? null : (
		<div className="flex flex-col gap-1 text-sm">
			<p className="font-semibold">{label}</p>
			<ul className="list-disc pl-6 font-mono text-xs">
				{names.map((name) => (
					<li key={name}>{name}</li>
				))}
			</ul>
		</div>
	);

interface Props {
	/** `facts.json` as parsed; absent before the facts are verified. */
	facts: PlanFacts | undefined;
}

/** What the planner confirmed in the code before drafting: the request, how the paths checked out, then each explored area. */
export const FactsDetail = ({ facts }: Props) => {
	if (facts === undefined) {
		return <p className={noteClass}>No facts recorded yet.</p>;
	}

	const { verification } = facts;

	return (
		<div className="flex flex-col gap-8">
			<p className="text-sm leading-6">{facts.request}</p>
			<p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
				<span>
					{verification.pathsChecked} paths checked · {verification.missingPaths.length} missing
				</span>
				<span>
					{verification.scriptsChecked} scripts checked · {verification.missingScripts.length} missing
				</span>
				<span className="text-muted-foreground text-xs">{formatLocalTime({ iso: facts.verifiedAt })}</span>
			</p>
			<MissingList label="Missing paths" names={verification.missingPaths} />
			<MissingList label="Missing scripts" names={verification.missingScripts} />
			{facts.areas.map((area) => (
				<AreaSection key={area.area} area={area} />
			))}
		</div>
	);
};
