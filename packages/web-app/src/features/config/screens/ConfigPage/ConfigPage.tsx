import type { ConfigView } from '@lightsout/engine';
import { StandardsPackSource } from '@lightsout/engine/contracts';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { FileCog } from 'lucide-react';
import { Badge } from '#src/appUI/badges/Badge.tsx';
import { PageHeader } from '#src/appUI/headers/PageHeader.tsx';
import { SettingsCard } from '#src/appUI/panels/SettingsCard.tsx';
import { BadgeVariant } from '#src/common/constants/BadgeVariant.ts';
import { configQueryOptions } from '#src/features/config/queries/configQueryOptions.ts';
import { ConfigFieldRow } from '#src/features/config/screens/ConfigPage/internal/components/ConfigFieldRow.tsx';
import { RuleLedger } from '#src/features/config/screens/ConfigPage/internal/components/RuleLedger.tsx';

const sourceBadges: Record<StandardsPackSource, { label: string; variant: BadgeVariant }> = {
	[StandardsPackSource.Named]: { label: 'named', variant: BadgeVariant.Brand },
	[StandardsPackSource.Detected]: { label: 'detected', variant: BadgeVariant.Neutral },
};

const PackRow = ({ group }: { group: ConfigView['standardsGroups'][number] }) => (
	<div className="flex flex-wrap items-center gap-2 border-border border-b py-3 first:pt-0 last:border-0 last:pb-0">
		<Link to="/standards-packs" className="font-medium text-sm hover:underline hover:underline-offset-2">
			{group.pack}
		</Link>
		<Badge variant={sourceBadges[group.source].variant}>{sourceBadges[group.source].label}</Badge>
		<p className="w-full text-muted-foreground text-xs">Applies to {group.appliesTo}.</p>
	</div>
);

/**
 * A viewer rather than an editor, deliberately: the file is the record, and a
 * page that could write it would be a second author of run state.
 */
export const ConfigPage = () => {
	const { data: view } = useSuspenseQuery(configQueryOptions());

	return (
		<div className="flex flex-col gap-4 p-6">
			<PageHeader icon={FileCog} title="Config" description={<span className="font-mono">{view.path}</span>} />
			{view.sections.map((section) => (
				<SettingsCard key={section.title} title={section.title}>
					<div className="flex flex-col">
						{section.fields.map((field) => (
							<ConfigFieldRow key={field.key} field={field} />
						))}
					</div>
				</SettingsCard>
			))}
			<SettingsCard title="Standards pack in use" description="The packs a run works against here, how each was chosen and which packages it covers.">
				{view.standardsGroups.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						No standards load here — `standards-pack` is set to false and `package-standards-packs` names no package.
					</p>
				) : (
					<div className="flex flex-col">
						{view.standardsGroups.map((group) => (
							<PackRow key={group.packages.join(',')} group={group} />
						))}
					</div>
				)}
			</SettingsCard>
			<SettingsCard title="Rules" description="Every loaded rule at the state it runs at here — the same ledger `standards-check --list` prints.">
				<RuleLedger ruleStates={view.ruleStates} />
			</SettingsCard>
			<Link to="/docs/$doc" params={{ doc: 'configuration' }} className="text-brand-to text-sm underline underline-offset-4">
				What every key means →
			</Link>
		</div>
	);
};
