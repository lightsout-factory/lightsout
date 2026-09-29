interface Params<Attachment> {
	attachments: Attachment[];
	/** The plan id whose namespace the list is narrowed to. */
	prefix: string;
}

/** Generic over `{ title }` so the shared folder never imports the tracker's own attachment type. */
export const scopeAttachments = <Attachment extends { title: string }>({ attachments, prefix }: Params<Attachment>): Attachment[] => {
	const namespace = `${prefix}--`;

	return attachments
		.filter(({ title }) => title.startsWith(namespace))
		.map((attachment) => ({ ...attachment, title: attachment.title.slice(namespace.length) }));
};
