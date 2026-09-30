import { StandardsSet } from '@lightsout/standards-contracts';
import { collectGroupItems } from '#src/common/utils/collectGroupItems.ts';
import { describePackageSet } from '#src/common/workspace/describePackageSet.ts';
import type { StandardsGroup } from '#src/standards/common/types/StandardsGroup.ts';
import type { LoadedStandardsTopic } from '#src/standardsLibraries/common/types/LoadedStandardsTopic.ts';

interface Params {
	groups: StandardsGroup[];
}

interface RenderedRule {
	prose: string;
	/** The packages the rule reaches agents in. */
	packages: Set<string>;
}

interface TopicEntry {
	topic: LoadedStandardsTopic;
	/** The packages of every group whose pack includes the topic. */
	packages: Set<string>;
}

const compareText = ({ left, right }: { left: string; right: string }) => (left === right ? 0 : left > right ? 1 : -1);

const byLibraryThenPath = (left: TopicEntry, right: TopicEntry) =>
	compareText({ left: left.topic.library, right: right.topic.library }) || compareText({ left: left.topic.path, right: right.topic.path });

const labelOf = ({ packages }: { packages: Set<string> }) => describePackageSet({ packages: [...packages] });

/** Each topic once, however many packs include it, with the packages it applies to. */
const collectTopics = ({ groups, set }: { groups: StandardsGroup[]; set: StandardsSet }) =>
	[
		...collectGroupItems({
			groups,
			itemsOf: ({ group }) => group.pack.topics.filter((candidate) => candidate.set === set),
			keyOf: ({ item }) => item,
		}).values(),
	]
		.map(({ item, packages }) => ({ topic: item, packages }))
		.sort(byLibraryThenPath);

/** A rule reaches agents in a group only while its state there says so; a rule reaching no group is left out. */
const collectRules = ({ groups }: { groups: StandardsGroup[] }) => {
	const rules = new Map<string, RenderedRule>();
	const collected = collectGroupItems({
		groups,
		itemsOf: ({ group }) => group.pack.rules.map(({ rule }) => rule).filter((rule) => group.states.get(rule.name)?.reachesAgents === true),
		keyOf: ({ item }) => item.name,
	});

	for (const [name, { item, packages }] of collected) {
		rules.set(name, { prose: item.prose, packages });
	}

	return rules;
};

/** Pushes every ATX heading two levels down so it nests under an Applies to heading; fenced code is left alone. */
const demoteHeadings = ({ text }: { text: string }) => {
	let fence: string | undefined;

	return text
		.split('\n')
		.map((line) => {
			const fenceMatch = /^ {0,3}(`{3,}|~{3,})/.exec(line);

			if (fenceMatch !== null) {
				const marker = fenceMatch[1];

				if (fence === undefined) {
					fence = marker;
				} else if (marker[0] === fence[0] && marker.length >= fence.length) {
					fence = undefined;
				}

				return line;
			}

			const heading = fence === undefined ? /^( {0,3})(#{1,6})(?=\s|$)/.exec(line) : null;

			return heading === null ? line : `${heading[1]}${'#'.repeat(Math.min(heading[2].length + 2, 6))}${line.slice(heading[0].length)}`;
		})
		.join('\n');
};

const renderTopic = ({ entry, rules, nested }: { entry: TopicEntry; rules: Map<string, RenderedRule>; nested: boolean }) => {
	const { topic } = entry;
	const shape = (text: string) => (nested ? demoteHeadings({ text }) : text);
	const topicLabel = labelOf({ packages: entry.packages });
	// A topic lists its rules by short id, which is unique inside the topic's own library.
	const prose = topic.ruleIds.flatMap((id) => {
		const rule = rules.get(`${topic.library}/${id}`);

		if (rule === undefined || rule.prose.length === 0) {
			return [];
		}

		const ruleLabel = labelOf({ packages: rule.packages });

		return nested && ruleLabel !== topicLabel ? [`Applies only to: ${ruleLabel}\n\n${shape(rule.prose)}`] : [shape(rule.prose)];
	});
	const parts = [shape(topic.intro), ...prose].filter((part) => part.length > 0);

	return `<!-- ${topic.library}: ${topic.path} -->\n${parts.join('\n\n')}`;
};

/** True when every topic and every rendered rule applies to the whole scope, so no heading or note would add anything. */
const appliesEverywhere = ({ topics, rules, scope }: { topics: TopicEntry[]; rules: Map<string, RenderedRule>; scope: Set<string> }) =>
	topics.every(
		({ topic, packages }) =>
			packages.size === scope.size &&
			topic.ruleIds.every((id) => {
				const rule = rules.get(`${topic.library}/${id}`);

				return rule === undefined || rule.packages.size === scope.size;
			}),
	);

/** Topics grouped by their exact package set, widest first, each set under one level-2 heading. */
const renderWithHeadings = ({ topics, rules }: { topics: TopicEntry[]; rules: Map<string, RenderedRule> }) => {
	const bySet = new Map<string, { size: number; entries: TopicEntry[] }>();

	for (const entry of topics) {
		const label = labelOf({ packages: entry.packages });
		const bucket = bySet.get(label) ?? { size: entry.packages.size, entries: [] };

		bucket.entries.push(entry);
		bySet.set(label, bucket);
	}

	return [...bySet.entries()]
		.sort(([leftLabel, left], [rightLabel, right]) => right.size - left.size || compareText({ left: leftLabel, right: rightLabel }))
		.map(([label, { entries }]) => [`## Applies to: ${label}`, ...entries.map((entry) => renderTopic({ entry, rules, nested: true }))].join('\n\n'))
		.join('\n\n');
};

const renderSet = ({ groups, set }: { groups: StandardsGroup[]; set: StandardsSet }) => {
	const topics = collectTopics({ groups, set });
	const rules = collectRules({ groups });
	const scope = new Set(groups.flatMap((group) => group.packages));
	let rendered: string | undefined;

	if (topics.length > 0) {
		rendered = appliesEverywhere({ topics, rules, scope })
			? topics.map((entry) => renderTopic({ entry, rules, nested: false })).join('\n\n')
			: renderWithHeadings({ topics, rules });
	}

	return rendered;
};

/**
 * Assembled at load time from the rule folders themselves, so there is no
 * pre-built copy anywhere that can drift from the prose.
 *
 * A rule's prose goes to agents only while its state `reachesAgents`. A rule
 * the pack ships `off` is one a repo opts into, so its prose is left out until
 * the repo turns it on: an agent told to follow a convention the repo never
 * chose writes code the repo's own reviewers reject. A rule the repo turned off
 * itself keeps its prose — off there means its own linter enforces the rule,
 * and the standard still holds.
 *
 * When the groups' packs differ, each set is grouped under "Applies to"
 * headings, so an agent working across packages reads each topic once and
 * knows where it holds. When everything applies everywhere there is no heading,
 * however many groups there are.
 */
export const buildStandardsDocuments = ({ groups }: Params): { code?: string; tests?: string } => {
	const code = renderSet({ groups, set: StandardsSet.Code });
	const tests = renderSet({ groups, set: StandardsSet.Tests });
	const assembled: { code?: string; tests?: string } = {};

	if (code !== undefined) {
		assembled.code = code;
	}

	if (tests !== undefined) {
		assembled.tests = tests;
	}

	return assembled;
};
