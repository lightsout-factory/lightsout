interface Params {
	/** The plan id the title is namespaced under. */
	prefix: string;
	/** The file's own bare name, exactly as the commit marker lists it. */
	name: string;
}

/**
 * The separator is two hyphens because a plan id never holds two in a row,
 * which is what lets `scopeAttachments` tell `001-a--plan.md` from a longer
 * id's `001-a-b--plan.md`.
 */
export const attachmentTitle = ({ prefix, name }: Params): string => `${prefix}--${name}`;
