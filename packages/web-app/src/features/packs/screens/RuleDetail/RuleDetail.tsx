import type { StandardsPackView } from '@lightsout/engine';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { Markdown } from '#src/appUI/Markdown.tsx';
import { toCheckKind } from '#src/common/utils/toCheckKind.ts';
import { PackPageFrame } from '#src/features/packs/components/PackPageFrame.tsx';
import { defaultPackQueryOptions } from '#src/features/packs/queries/defaultPackQueryOptions.ts';
import { defaultPackRuleQueryOptions } from '#src/features/packs/queries/defaultPackRuleQueryOptions.ts';
import { dropRepeatedTitle } from '#src/features/packs/screens/RuleDetail/internal/common/utils/dropRepeatedTitle.ts';
import { findNeighbourRules } from '#src/features/packs/screens/RuleDetail/internal/common/utils/findNeighbourRules.ts';
import { RuleConfiguration } from '#src/features/packs/screens/RuleDetail/internal/components/RuleConfiguration.tsx';
import { RuleExamples } from '#src/features/packs/screens/RuleDetail/internal/components/RuleExamples.tsx';
import { RuleHeader } from '#src/features/packs/screens/RuleDetail/internal/components/RuleHeader.tsx';
import { RuleNeighbours } from '#src/features/packs/screens/RuleDetail/internal/components/RuleNeighbours.tsx';

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
	<section className="flex flex-col gap-5 border-border border-t pt-8">
		<h2 className="font-bold text-drop-navy text-xl">{title}</h2>
		{children}
	</section>
);

/** Every pack of the library that selects the rule, each linking to its page. */
const RulePacks = ({ library, ruleName }: { library: StandardsPackView; ruleName: string }) => {
	const holding = library.packs.filter((pack) => pack.rules.some((entry) => entry.name === ruleName));

	return holding.length === 0 ? (
		<p className="text-muted-foreground text-sm">No pack in the {library.name} library selects this rule; a team can still include it in a pack of its own.</p>
	) : (
		<ul className="flex flex-wrap gap-2">
			{holding.map((pack) => (
				<li key={pack.name}>
					<Link
						to="/standards-packs/$library/packs/$pack"
						params={{ library: library.name, pack: pack.name }}
						className="inline-flex rounded-lg border border-border px-3 py-1.5 font-mono font-semibold text-drop-navy text-sm transition-colors hover:border-primary-tint-border hover:bg-muted/40"
					>
						{pack.address}
					</Link>
				</li>
			))}
		</ul>
	);
};

interface Props {
	ruleId: string;
}

/** The check's source is deliberately left out: a reader judges a rule by its argument and examples, not its implementation. */
export const RuleDetail = ({ ruleId }: Props) => {
	const { data: rule } = useSuspenseQuery(defaultPackRuleQueryOptions({ rule: ruleId }));
	const { data: library } = useSuspenseQuery(defaultPackQueryOptions());
	const prose = dropRepeatedTitle({ prose: rule.prose, ruleId: rule.id });

	return (
		<PackPageFrame crumbs={[{ label: 'Standards Packs', link: { to: '/standards-packs' } }, { label: library.name }, { label: rule.id }]}>
			<RuleHeader rule={rule} />
			<Section title="The rule">
				{prose === '' ? (
					<p className="text-muted-foreground text-sm">This rule states its summary and shows it with examples.</p>
				) : (
					<>
						<p className="text-muted-foreground text-sm">Agents read this text as written when they write and review code.</p>
						<Markdown text={prose} />
					</>
				)}
			</Section>
			<Section title="Examples">
				<RuleExamples fixtures={rule.fixtures} kind={toCheckKind({ checked: rule.checked })} example={rule.example} />
			</Section>
			<Section title="Configure">
				<RuleConfiguration rule={rule} />
			</Section>
			<Section title="Packs that select it">
				<RulePacks library={library} ruleName={rule.name} />
			</Section>
			<RuleNeighbours library={library.name} {...findNeighbourRules({ topics: library.topics, rules: library.rules, ruleId: rule.id })} />
		</PackPageFrame>
	);
};
