/**
 * The placeholders a parameterised test name carries: printf conversions jest
 * substitutes positionally, and `$name` property references it substitutes by
 * key.
 */
const placeholder = /%[sdifjop#%]|\$[A-Za-z_$][\w$]*(?:\.[\w$]+)*/g;

const escapeLiteral = ({ text }: { text: string }) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

interface Params {
	/** The name a ledger row (or an acceptance-test record) carries. */
	testName: string;
	/** A title as a file states it, or as the runner reported it. */
	title: string;
}

/**
 * The one rule the static locator and the execution check share, so the two
 * never disagree about what a row names.
 *
 * A name with a placeholder is a `.each` template: it matches the template as a
 * file states it or any title it could have produced. The name alone decides,
 * so one call serves a file's static title and the runner's substituted one.
 */
export const matchesTestTitle = ({ testName, title }: Params): boolean => {
	if (title === testName) {
		return true;
	}

	const literalParts = testName.split(placeholder);

	return literalParts.length > 1 && new RegExp(`^${literalParts.map((part) => escapeLiteral({ text: part })).join('.*')}$`).test(title);
};
