import { messageOf } from '#src/common/messageOf.ts';
import type { AttachmentManifest } from '#src/common/types/AttachmentManifest.ts';

interface Params {
	text: string;
	/** The marker's own attachment title, spelled into every refusal. */
	markerName: string;
	/** Which bare file names this generation may carry. */
	isAllowedName: (params: { name: string }) => boolean;
}

export const parseAttachmentManifest = ({ text, markerName, isAllowedName }: Params): { manifest: AttachmentManifest } | { error: string } => {
	let value: unknown;

	try {
		value = JSON.parse(text);
	} catch (error) {
		return { error: `${markerName} is not valid JSON: ${messageOf({ error })}` };
	}

	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		return { error: `${markerName} must contain an object` };
	}

	const schemaVersion: unknown = 'schemaVersion' in value ? value.schemaVersion : undefined;
	const listed: unknown = 'files' in value ? value.files : undefined;

	if (schemaVersion !== 1) {
		return { error: `${markerName} has unsupported schemaVersion ${JSON.stringify(schemaVersion)} — expected 1` };
	}

	if (!Array.isArray(listed) || listed.length === 0) {
		return { error: `${markerName} must list at least one durable plan file` };
	}

	const entries: unknown[] = listed;
	const files: AttachmentManifest['files'] = [];

	for (const entry of entries) {
		if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
			return { error: `${markerName} contains a file entry that is not an object` };
		}

		const fileName: unknown = 'name' in entry ? entry.name : undefined;
		const sha256: unknown = 'sha256' in entry ? entry.sha256 : undefined;

		if (typeof fileName !== 'string' || !isAllowedName({ name: fileName })) {
			return { error: `${markerName} contains a non-durable or unsafe file name: ${JSON.stringify(fileName)}` };
		}

		if (typeof sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(sha256)) {
			return { error: `${markerName} contains an invalid SHA-256 for ${fileName}` };
		}

		if (files.some(({ name }) => name === fileName)) {
			return { error: `${markerName} lists ${fileName} more than once` };
		}

		files.push({ name: fileName, sha256 });
	}

	return { manifest: { schemaVersion: 1, files } };
};
