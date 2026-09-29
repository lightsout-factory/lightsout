import type { StandardsPackBundle } from '#src/contracts/views/StandardsPackBundle.ts';
import type { StandardsPackListing } from '#src/contracts/views/StandardsPackListing.ts';

interface Params {
	bundle: StandardsPackBundle;
}

const countRulesByChannel = ({ bundle }: Params) =>
	bundle.channels.flatMap((channel) => {
		const rules = bundle.rules.filter((rule) => rule.channel === channel);
		const checked = rules.filter((rule) => rule.checked).length;

		return rules.length === 0 ? [] : [{ channel, rules: rules.length, checked, judgment: rules.length - checked }];
	});

/** Fields are named one by one rather than spread, so a field added to the bundle never reaches the wire by accident. */
export const toStandardsPackListing = ({ bundle }: Params): StandardsPackListing => ({
	name: bundle.name,
	...(bundle.description === undefined ? {} : { description: bundle.description }),
	...(bundle.homepage === undefined ? {} : { homepage: bundle.homepage }),
	isDefault: bundle.isDefault,
	rootPath: bundle.rootPath,
	path: bundle.path,
	built: bundle.built,
	channels: bundle.channels,
	channelTotals: countRulesByChannel({ bundle }),
	totals: bundle.totals,
});
