interface Params {
	/** The document's intro — its `topic.md` body, which opens on a `# ` heading. */
	intro: string;
	/** Pack-relative folder path, the fallback when the intro has no heading. */
	path: string;
}

export const readDocumentTitle = ({ intro, path }: Params): string => {
	const heading = /^#\s+(.+)$/m.exec(intro)?.[1]?.trim();
	const folder = path.split('/').at(-1) ?? path;

	return heading ?? folder.charAt(0).toUpperCase() + folder.slice(1).replaceAll('-', ' ');
};
