import { useSuspenseQuery } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import { Card } from '#src/appUI/panels/Card.tsx';
import { standardsQueryOptions } from '#src/features/standards/queries/standardsQueryOptions.ts';
import { FindingList } from '#src/features/standards/screens/StandardsPage/internal/components/FindingList.tsx';
import { FolderBreakdown } from '#src/features/standards/screens/StandardsPage/internal/components/FolderBreakdown.tsx';
import { StandardsHeader } from '#src/features/standards/screens/StandardsPage/internal/components/StandardsHeader.tsx';
import { StandardsTrendChart } from '#src/features/standards/screens/StandardsPage/internal/components/StandardsTrendChart.tsx';

/**
 * The rule filter lives in the URL so `?rule=<id>` links from the health and rule
 * pages land on the right rows. The folder facet and its depth stay in component
 * state: they describe how this reader is looking, not what they are looking at.
 */
export const StandardsPage = () => {
	const { data: view } = useSuspenseQuery(standardsQueryOptions());
	const search = useSearch({ from: '/app/standards' });
	const navigate = useNavigate({ from: '/app/standards' });
	// Opens at a folder inside one package's src, which is where a repo's debt usually gathers.
	const [depth, setDepth] = useState(4);
	const [folderFilter, setFolderFilter] = useState<string | undefined>(undefined);
	const ruleFilter = search.rule;
	const findings = ruleFilter === undefined ? view.findings : view.findings.filter((finding) => finding.rule === ruleFilter);

	return (
		<div className="flex flex-col gap-6 p-6">
			<StandardsHeader view={view} />
			<Card title="Trend">
				<StandardsTrendChart points={view.trend} path={view.path} />
			</Card>
			<div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[20rem_1fr]">
				<FolderBreakdown findings={findings} depth={depth} onDepthChange={setDepth} folderFilter={folderFilter} onFolderFilterChange={setFolderFilter} />
				<FindingList
					findings={findings}
					loadedRules={view.rules.map((rule) => rule.rule)}
					ruleFilter={ruleFilter}
					onRuleFilterChange={(rule) => void navigate({ search: { rule }, replace: true })}
					folderFilter={folderFilter}
					depth={depth}
				/>
			</div>
		</div>
	);
};
