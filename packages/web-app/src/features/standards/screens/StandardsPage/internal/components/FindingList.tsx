import type { StandardsFinding } from '@lightsout/engine';
import { StandardsSeverity } from '@lightsout/engine/contracts';
import { useState } from 'react';
import { Badge } from '#src/appUI/badges/Badge.tsx';
import { MetadataTag } from '#src/appUI/badges/MetadataTag.tsx';
import { CopyButton } from '#src/appUI/buttons/CopyButton.tsx';
import { DataTable } from '#src/appUI/DataTable.tsx';
import { EmptyState } from '#src/appUI/EmptyState.tsx';
import { BadgeVariant } from '#src/common/constants/BadgeVariant.ts';
import type { DataTableColumn } from '#src/common/types/DataTableColumn.ts';
import { getFindingFolder } from '#src/features/standards/internal/common/utils/getFindingFolder.ts';

const describeFile = ({ file }: { file: StandardsFinding['files'][number] }) => {
	if (file.startLine === undefined) {
		return file.path;
	}

	return `${file.path}:${file.startLine}${file.endLine === undefined ? '' : `-${file.endLine}`}`;
};

/** A finding's own key, since a rule may report the same site under two spans. */
const getFindingKey = ({ finding }: { finding: StandardsFinding }) => `${finding.rule}:${finding.siteKey}:${finding.files[0]?.startLine ?? ''}`;

interface RuleCellProps {
	finding: StandardsFinding;
	loaded: boolean;
	active: boolean;
	onToggle: () => void;
}

/**
 * Not a link to the rule's page: a finding carries no pack, and the view records
 * the pack only inside a display string nobody should re-parse.
 */
const RuleCell = ({ finding, loaded, active, onToggle }: RuleCellProps) => (
	<span className="flex items-center gap-1.5">
		<button type="button" aria-pressed={active} onClick={onToggle} className="font-mono text-sm underline decoration-dotted underline-offset-2">
			{finding.rule}
		</button>
		{loaded ? null : <Badge>not loaded</Badge>}
	</span>
);

const FindingDetails = ({ finding }: { finding: StandardsFinding }) => (
	<tr className="border-border border-b bg-muted last:border-0">
		{/* The four columns plus the disclosure cell the table draws in front of them. */}
		<td colSpan={5} className="px-3 py-3">
			<div className="flex flex-col gap-2 text-xs">
				{finding.guidance === undefined ? null : <p className="leading-5">{finding.guidance}</p>}
				{finding.files.length === 0 ? null : (
					<ul className="flex flex-col gap-0.5 font-mono text-muted-foreground">
						{finding.files.map((file) => (
							<li key={describeFile({ file })}>{describeFile({ file })}</li>
						))}
					</ul>
				)}
				<div className="flex items-center gap-2">
					<code className="min-w-0 truncate rounded-md bg-background px-2 py-1 font-mono">{finding.siteKey}</code>
					<CopyButton value={finding.siteKey} label="Copy site key" />
				</div>
			</div>
		</td>
	</tr>
);

interface Props {
	findings: StandardsFinding[];
	/** Rule ids whose prose still loads — a finding outside this set keeps its muted "not loaded" tag. */
	loadedRules: string[];
	/** The active rule filter, or undefined for all rules. Owned by the page, seeded from `?rule=`. */
	ruleFilter?: string;
	onRuleFilterChange: (rule: string | undefined) => void;
	folderFilter?: string;
	/** The depth the folder labels were truncated at, so a row can be matched against the label a reader clicked. */
	depth: number;
}

/** The site key is shown exactly as recorded, because a reader cross-referencing a batch report pastes it. */
export const FindingList = ({ findings, loadedRules, ruleFilter, onRuleFilterChange, folderFilter, depth }: Props) => {
	const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
	const loaded = new Set(loadedRules);
	const rows = findings.filter((finding) => folderFilter === undefined || getFindingFolder({ finding, depth }) === folderFilter);
	const columns: Array<DataTableColumn<StandardsFinding>> = [
		{
			key: 'rule',
			header: 'rule',
			sortValue: (finding) => finding.rule,
			render: (finding) => (
				<RuleCell
					finding={finding}
					loaded={loaded.has(finding.rule)}
					active={ruleFilter === finding.rule}
					onToggle={() => onRuleFilterChange(ruleFilter === finding.rule ? undefined : finding.rule)}
				/>
			),
		},
		{
			key: 'severity',
			header: 'severity',
			render: (finding) => (
				<Badge variant={finding.severity === StandardsSeverity.Blocking ? BadgeVariant.Blocking : BadgeVariant.Advisory}>{finding.severity}</Badge>
			),
		},
		{
			key: 'site',
			header: 'site',
			render: (finding) =>
				finding.files.length === 0 ? <span className="text-muted-foreground">—</span> : <MetadataTag>{describeFile({ file: finding.files[0] })}</MetadataTag>,
		},
		{ key: 'detail', header: 'detail', className: 'max-w-xl', render: (finding) => <span className="leading-5">{finding.detail}</span> },
	];

	return (
		<DataTable
			rows={rows}
			columns={columns}
			getRowKey={(finding) => getFindingKey({ finding })}
			expandedKeys={expandedKeys}
			onToggleExpanded={(key) => setExpandedKeys(expandedKeys.includes(key) ? expandedKeys.filter((entry) => entry !== key) : [...expandedKeys, key])}
			renderExpanded={(finding) => <FindingDetails finding={finding} />}
			empty={
				<EmptyState
					title={ruleFilter === undefined ? 'Nothing is open in the latest snapshot.' : `Nothing is open under ${ruleFilter}.`}
					description={folderFilter === undefined ? undefined : `Narrowed to ${folderFilter}.`}
				/>
			}
		/>
	);
};
