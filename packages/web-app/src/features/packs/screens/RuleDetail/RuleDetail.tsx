import { useSuspenseQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Markdown } from '#src/appUI/Markdown.tsx';
import { toCheckKind } from '#src/common/utils/toCheckKind.ts';
import { PackPageFrame } from '#src/features/packs/components/PackPageFrame.tsx';
import { describeChannel } from '#src/features/packs/internal/common/utils/describeChannel.ts';
import { toRuleSetSlug } from '#src/features/packs/internal/common/utils/toRuleSetSlug.ts';
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

interface Props {
	ruleId: string;
}

/** The check's source is deliberately left out: a reader judges a rule by its argument and examples, not its implementation. */
export const RuleDetail = ({ ruleId }: Props) => {
	const { data: rule } = useSuspenseQuery(defaultPackRuleQueryOptions({ rule: ruleId }));
	const { data: pack } = useSuspenseQuery(defaultPackQueryOptions());
	const prose = dropRepeatedTitle({ prose: rule.prose, ruleId: rule.id });

	return (
		<PackPageFrame
			crumbs={[
				{ label: 'Standards Packs', link: { to: '/standards-packs' } },
				{
					label: describeChannel({ channel: rule.channel }).name,
					link: { to: '/standards-packs/$ruleSet', params: { ruleSet: toRuleSetSlug({ channel: rule.channel }) } },
				},
				{ label: rule.id },
			]}
		>
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
			<RuleNeighbours {...findNeighbourRules({ documents: pack.documents, rules: pack.rules, ruleId: rule.id })} />
		</PackPageFrame>
	);
};
