import type { StandardsPackView } from '@lightsout/engine';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Markdown } from '#src/common/content/Markdown/Markdown.tsx';
import { SitePageFrame } from '#src/common/site/SitePageFrame.tsx';
import { SiteSection } from '#src/common/site/SiteSection.tsx';
import { toCheckKinds } from '#src/packs/common/toCheckKinds.ts';
import { defaultPackQueryOptions } from '#src/packs/defaultPackQueryOptions.ts';
import { defaultPackRuleQueryOptions } from '#src/packs/defaultPackRuleQueryOptions.ts';
import { dropRepeatedTitle } from '#src/packs/RuleDetailScreen/dropRepeatedTitle.ts';
import { findNeighbourRules } from '#src/packs/RuleDetailScreen/findNeighbourRules.ts';
import { RuleConfiguration } from '#src/packs/RuleDetailScreen/RuleConfiguration.tsx';
import { RuleExamples } from '#src/packs/RuleDetailScreen/RuleExamples/RuleExamples.tsx';
import { RuleHeader } from '#src/packs/RuleDetailScreen/RuleHeader.tsx';
import { RuleNeighbours } from '#src/packs/RuleDetailScreen/RuleNeighbours.tsx';

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
export const RuleDetailScreen = ({ ruleId }: Props) => {
	const { data: rule } = useSuspenseQuery(defaultPackRuleQueryOptions({ rule: ruleId }));
	const { data: library } = useSuspenseQuery(defaultPackQueryOptions());
	const prose = dropRepeatedTitle({ prose: rule.prose, ruleId: rule.id });

	return (
		<SitePageFrame crumbs={[{ label: 'Standards Packs', link: { to: '/standards-packs' } }, { label: library.name }, { label: rule.id }]}>
			<RuleHeader rule={rule} />
			<SiteSection title="The rule">
				{prose === '' ? (
					<p className="text-muted-foreground text-sm">This rule states its summary and shows it with examples.</p>
				) : (
					<>
						<p className="text-muted-foreground text-sm">Agents read this text as written when they write and review code.</p>
						<Markdown text={prose} />
					</>
				)}
			</SiteSection>
			<SiteSection title="Examples">
				<RuleExamples fixtures={rule.fixtures} kinds={toCheckKinds({ deterministic: rule.deterministic, agent: rule.agent })} example={rule.example} />
			</SiteSection>
			<SiteSection title="Configure">
				<RuleConfiguration rule={rule} />
			</SiteSection>
			<SiteSection title="Packs that select it">
				<RulePacks library={library} ruleName={rule.name} />
			</SiteSection>
			<RuleNeighbours library={library.name} {...findNeighbourRules({ topics: library.topics, rules: library.rules, ruleId: rule.id })} />
		</SitePageFrame>
	);
};
