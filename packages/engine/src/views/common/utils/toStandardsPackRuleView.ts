import type { StandardsPackBundle } from '#src/contracts/views/StandardsPackBundle.ts';
import type { StandardsPackRuleView } from '#src/contracts/views/StandardsPackRuleView.ts';
import { StandardsPackRuleNotFoundError } from '#src/views/StandardsPackRuleNotFoundError.ts';

interface Params {
	bundle: StandardsPackBundle;
	rule: string;
}

/**
 * @param rule - the short rule id a page address carries, not the full `<library>/<id>` name
 * @throws {StandardsPackRuleNotFoundError} When no rule in the bundle carries the id.
 */
export const toStandardsPackRuleView = ({ bundle, rule }: Params): StandardsPackRuleView => {
	const found = bundle.rules.find((entry) => entry.id === rule);

	if (found === undefined) {
		throw new StandardsPackRuleNotFoundError({ name: bundle.name, rule });
	}

	return found;
};
