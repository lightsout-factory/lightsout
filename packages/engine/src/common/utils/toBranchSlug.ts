interface Params {
	text: string;
}

/**
 * Shared so the branch a ticket gets from the queue cannot drift from the
 * branch the same ticket gets from `implement`. Text with nothing branch-safe
 * answers an empty string; the caller decides what that means.
 */
export const toBranchSlug = ({ text }: Params): string => {
	const maxSlugLength = 40;
	const dashed = text
		.toLowerCase()
		.replaceAll(/[^a-z0-9]+/g, '-')
		.replaceAll(/^-+|-+$/g, '');

	let slug = dashed;

	if (dashed.length > maxSlugLength) {
		const cut = dashed.slice(0, maxSlugLength);
		const lastDash = cut.lastIndexOf('-');

		slug = lastDash === -1 ? cut : cut.slice(0, lastDash);
	}

	// The trailing-dash strip is on the single exit path, so a cut made on a
	// dash cannot leave one behind whichever branch produced the slug.
	return slug.replaceAll(/-+$/g, '');
};
