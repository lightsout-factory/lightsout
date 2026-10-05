interface Params<Attachment> {
	attachments: Attachment[];
	/** The title the commit marker lists. */
	name: string;
	markerName: string;
}

/** A listed title the ticket carries zero or several times cannot name one generation, so both are refused. */
export const selectListedAttachment = <Attachment extends { title: string }>({
	attachments,
	name,
	markerName,
}: Params<Attachment>): { attachment: Attachment } | { error: string } => {
	const matches = attachments.filter(({ title }) => title === name);
	const attachment = matches.length === 1 ? matches[0] : undefined;

	if (attachment === undefined) {
		return {
			error:
				matches.length === 0
					? `${markerName} lists ${name}, but the ticket carries no attachment with that title`
					: `the ticket carries more than one attachment named ${name}, so ${markerName} cannot select one generation`,
		};
	}

	return { attachment };
};
