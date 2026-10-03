import type { StandardsPackListing } from '@lightsout/engine';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { CheckKind } from '#src/common/constants/CheckKind.ts';
import { checkKindLabels } from '#src/common/constants/checkKindLabels.ts';
import { CodeSpans } from '#src/features/packs/components/CodeSpans.tsx';
import { PackCondition } from '#src/features/packs/components/PackCondition.tsx';
import { PackPageFrame } from '#src/features/packs/components/PackPageFrame.tsx';
import { groupRulesByTopic } from '#src/features/packs/internal/common/utils/groupRulesByTopic.ts';
import { readDocumentTitle } from '#src/features/packs/internal/common/utils/readDocumentTitle.ts';
import { defaultPackQueryOptions } from '#src/features/packs/queries/defaultPackQueryOptions.ts';
import type { PackRuleFilters } from '#src/features/packs/screens/PackPage/internal/common/types/PackRuleFilters.ts';
import { filterPackRules } from '#src/features/packs/screens/PackPage/internal/common/utils/filterPackRules.ts';
import { RuleFilters } from '#src/features/packs/screens/PackPage/internal/components/RuleFilters.tsx';
import { RuleGroupNav } from '#src/features/packs/screens/PackPage/internal/components/RuleGroupNav.tsx';
import { RuleRow } from '#src/features/packs/screens/PackPage/internal/components/RuleRow.tsx';

/** An included pack of this library links to its page; one from another library is plain text, since these pages hold no page for it. */
const IncludedPack = ({ library, address }: { library: string; address: string }) => {
	const prefix = `${library}/`;

	return address.startsWith(prefix) ? (
		<Link
			to="/standards-packs/$library/packs/$pack"
			params={{ library, pack: address.slice(prefix.length) }}
			className="font-mono font-semibold text-primary hover:text-primary-hover"
		>
			{address}
		</Link>
	) : (
		<span className="font-mono font-semibold text-drop-navy">{address}</span>
	);
};

const PackHeader = ({ library, pack }: { library: string; pack: StandardsPackListing }) => {
	const figures = [
		{ label: 'Rules', value: pack.totals.rules },
		{ label: `${checkKindLabels[CheckKind.Deterministic].label}s`, value: pack.totals.deterministic },
		{ label: `${checkKindLabels[CheckKind.Agent].label}s`, value: pack.totals.agent },
	];

	return (
		<header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
			<div className="flex flex-col gap-2">
				<h1 className="font-extrabold font-mono text-4xl text-drop-navy tracking-tight">{pack.address}</h1>
				{pack.description === undefined ? null : <p className="text-muted-foreground">{pack.description}</p>}
				{pack.appliesWhen === undefined ? null : <PackCondition dependencies={pack.appliesWhen.dependencies} className="text-sm" />}
				{pack.include.packs.length === 0 ? null : (
					<div className="flex flex-wrap items-center gap-2 text-muted-foreground text-sm">
						<span>Includes</span>
						<ul className="flex flex-wrap gap-2">
							{pack.include.packs.map((address) => (
								<li key={address}>
									<IncludedPack library={library} address={address} />
								</li>
							))}
						</ul>
					</div>
				)}
			</div>
			<dl className="flex gap-8">
				{figures.map((figure) => (
					<div key={figure.label} className="flex flex-col-reverse gap-1">
						<dt className="font-semibold text-[11px] text-subtle-foreground uppercase tracking-widest">{figure.label}</dt>
						<dd className="font-bold text-2xl text-drop-navy">{figure.value}</dd>
					</div>
				))}
			</dl>
		</header>
	);
};

interface Props {
	/** The pack's name within the bundled library — the last segment of its address. */
	pack: string;
	filters: PackRuleFilters;
	onFiltersChange: (filters: PackRuleFilters) => void;
}

/**
 * Shows the rules the pack resolves to, not every rule of its topics. An entry
 * for another library finds no row in this bundle and is left out; the route
 * guarantees the pack itself exists.
 */
export const PackPage = ({ pack: packName, filters, onFiltersChange }: Props) => {
	const { data: view } = useSuspenseQuery(defaultPackQueryOptions());
	const pack = view.packs.find((entry) => entry.name === packName);
	const severities = new Map(pack?.rules.map((entry) => [entry.name, entry.severity]));
	const topicAddresses = new Set(pack?.topics);
	const rules = view.rules.filter((rule) => severities.has(rule.name));
	const groups = groupRulesByTopic({
		topics: view.topics.filter((topic) => topicAddresses.has(`${view.name}/${topic.path}`)),
		rules: filterPackRules({ rules, filters }),
	}).map((group) => ({ ...group, id: group.topic.path.replaceAll('/', '-') }));

	return pack === undefined ? null : (
		<PackPageFrame crumbs={[{ label: 'Standards Packs', link: { to: '/standards-packs' } }, { label: pack.address }]}>
			<PackHeader library={view.name} pack={pack} />
			<div className="grid grid-cols-1 gap-10 lg:grid-cols-[14rem_1fr]">
				<aside className="hidden lg:block">
					<div className="sticky top-24">
						<RuleGroupNav groups={groups.map((group) => ({ id: group.id, topic: group.topic, count: group.rules.length }))} />
					</div>
				</aside>
				<div className="flex min-w-0 flex-col gap-8">
					<RuleFilters filters={filters} onFiltersChange={onFiltersChange} />
					{groups.length === 0 ? (
						<p className="rounded-2xl border border-border border-dashed px-6 py-12 text-center text-muted-foreground text-sm">No rule matches that.</p>
					) : (
						groups.map((group) => (
							<section key={group.id} id={group.id} aria-labelledby={`${group.id}-title`} className="flex scroll-mt-24 flex-col gap-3">
								<h2 id={`${group.id}-title`} className="flex items-baseline gap-2 font-bold text-drop-navy text-lg">
									<span>
										<CodeSpans text={readDocumentTitle({ intro: group.topic.intro, path: group.topic.path })} />
									</span>
									<span className="font-medium text-subtle-foreground text-sm">{group.rules.length}</span>
								</h2>
								<ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
									{group.rules.map((rule) => (
										<RuleRow key={rule.id} rule={rule} library={view.name} severity={severities.get(rule.name) ?? rule.defaultSeverity} />
									))}
								</ul>
							</section>
						))
					)}
				</div>
			</div>
		</PackPageFrame>
	);
};
