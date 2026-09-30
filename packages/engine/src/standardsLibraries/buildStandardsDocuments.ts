import { StandardsSet } from '@lightsout/standards-contracts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import type { LoadedStandardsLibrary } from '#src/standardsLibraries/common/types/LoadedStandardsLibrary.ts';
import type { LoadedStandardsTopic } from '#src/standardsLibraries/common/types/LoadedStandardsTopic.ts';

interface Params {
	pack: LoadedStandardsLibrary;
	/** Active framework channels; base documents always apply. */
	channels: string[];
	/** The repo's config — its `standards-rule-settings` entries decide which opt-in rules are in play. */
	config: LightsoutConfig | undefined;
}

const byPath = (left: LoadedStandardsTopic, right: LoadedStandardsTopic) => (left.path === right.path ? 0 : left.path > right.path ? 1 : -1);

const renderDocument = ({ name, document, proseById }: { name: string; document: LoadedStandardsTopic; proseById: Map<string, string> }) => {
	const parts = [document.intro, ...document.ruleIds.map((id) => proseById.get(id) ?? '')].filter((part) => part.length > 0);

	return `<!-- ${name}: ${document.path} -->\n${parts.join('\n\n')}`;
};

/**
 * Assembled at load time from the rule folders themselves, so there is no
 * pre-built copy anywhere that can drift from the prose.
 *
 * A rule the pack ships `off` is one a repo opts into, so its prose is left out
 * until the repo's config names it: an agent told to follow a convention the
 * repo never chose writes code the repo's own reviewers reject. A rule the repo
 * turned off itself keeps its prose — off there means its own linter enforces
 * the rule, and the standard still holds.
 */
export const buildStandardsDocuments = ({ pack, channels, config }: Params): { code?: string; tests?: string } => {
	const named = config?.['standards-rule-settings'] ?? {};
	const inPlay = pack.rules.filter((rule) => rule.defaultSeverity !== StandardsSeverity.Off || Object.hasOwn(named, rule.id));
	const proseById = new Map<string, string>(inPlay.map((rule) => [rule.id, rule.prose]));

	const renderSet = ({ set }: { set: StandardsSet }) => {
		const inSet = pack.documents.filter((document) => document.set === set);
		const inChannel = ({ channel }: { channel: string }) => inSet.filter((document) => document.channel === channel).sort(byPath);
		const ordered = [...inChannel({ channel: 'base' }), ...channels.flatMap((channel) => inChannel({ channel }))];

		return ordered.length === 0 ? undefined : ordered.map((document) => renderDocument({ name: pack.name, document, proseById })).join('\n\n');
	};

	const code = renderSet({ set: StandardsSet.Code });
	const tests = renderSet({ set: StandardsSet.Tests });
	const assembled: { code?: string; tests?: string } = {};

	if (code !== undefined) {
		assembled.code = code;
	}

	if (tests !== undefined) {
		assembled.tests = tests;
	}

	return assembled;
};
