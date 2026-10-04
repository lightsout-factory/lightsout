import { attachmentTitle } from '#src/common/attachmentManifest/attachmentTitle.ts';
import { parseAttachmentManifest } from '#src/common/attachmentManifest/parseAttachmentManifest.ts';
import { scopeAttachments } from '#src/common/attachmentManifest/scopeAttachments.ts';
import { sha256 } from '#src/common/sha256.ts';
import type { AttachmentManifest } from '#src/common/types/AttachmentManifest.ts';
import type { TrackerAttachment } from '#src/common/types/TrackerAttachment.ts';
import type { TrackerSettings } from '#src/common/types/TrackerSettings.ts';
import { planAttachmentManifestName } from '#src/plan/common/constants/planAttachmentManifestName.ts';
import { isPlanOnlyAttachmentName } from '#src/plan/internal/common/utils/isPlanOnlyAttachmentName.ts';
import { validatePlanAttachmentGeneration } from '#src/plan/internal/common/validatePlanAttachmentGeneration.ts';
import { planWorkspaceDir } from '#src/plan/planWorkspaceDir.ts';
import type { ReadGenerationFile } from '#src/plan/restore/internal/common/types/ReadGenerationFile.ts';
import { writeRestoredGeneration } from '#src/plan/restore/internal/common/utils/writeRestoredGeneration.ts';
import { getTicketAttachments } from '#src/ticketTracker/getTicketAttachments.ts';
import { readTicketAsset } from '#src/ticketTracker/readTicketAsset.ts';

interface Params {
	cwd: string;
	/** Kebab plan name — the folder the plan's own files live in. */
	name: string;
	/** The ticket reference that folder's name carries, e.g. 'lo-54'. */
	identifier: string;
	settings: TrackerSettings;
	/** The plan id the ticket's titles for this plan are namespaced under. */
	titlePrefix: string;
}

interface RestoredPlanWorkspace {
	/** Durable file names written into the folder, sorted. Empty when the ticket carries no plan. */
	restored: string[];
	/** Set when the ticket could not supply one complete, verified generation or it could not be written. */
	error?: string;
	/** SHA-256 of the marker text this generation was selected by, set for a prefixed restore that wrote a folder. */
	markerSha256?: string;
}

interface GenerationFile {
	title: string;
	url: string;
	sha256: string;
}

const readAttachment = async ({ settings, attachment }: { settings: TrackerSettings; attachment: TrackerAttachment }) => {
	const text = await readTicketAsset({ settings, url: attachment.url });

	return typeof text === 'string' ? { text } : { error: `the ticket's ${attachment.title} could not be read: ${text.error}` };
};

/** Unlisted durable attachments are stale by definition and harmless; a missing or duplicate listed title is not. */
const selectGeneration = ({
	manifest,
	durableAttachments,
	markerName,
}: {
	manifest: AttachmentManifest;
	durableAttachments: TrackerAttachment[];
	markerName: string;
}): { files: GenerationFile[] } | { error: string } => {
	const files: GenerationFile[] = [];

	for (const listed of manifest.files) {
		const matches = durableAttachments.filter(({ title }) => title === listed.name);
		const attachment = matches.length === 1 ? matches[0] : undefined;

		if (attachment === undefined) {
			return {
				error:
					matches.length === 0
						? `${markerName} lists ${listed.name}, but the ticket carries no attachment with that title`
						: `the ticket carries more than one attachment named ${listed.name}, so ${markerName} cannot select one generation`,
			};
		}

		files.push({ title: attachment.title, url: attachment.url, sha256: listed.sha256 });
	}

	return { files };
};

/**
 * No marker with no plan attachments at all is a ticket that has never carried
 * a plan; any other markerless or multi-marker ticket must be republished.
 */
const selectManifestAttachment = ({
	attachments,
	planOnlyAttachments,
	markerName,
}: {
	attachments: TrackerAttachment[];
	planOnlyAttachments: TrackerAttachment[];
	markerName: string;
}): { manifest: TrackerAttachment | undefined } | { error: string } => {
	const manifests = attachments.filter(({ title }) => title === planAttachmentManifestName);
	const manifest = manifests.length === 1 ? manifests[0] : undefined;

	if (manifest !== undefined) {
		return { manifest };
	}

	if (manifests.length > 1) {
		return { error: `the ticket carries more than one ${markerName} attachment, so no single committed plan generation can be selected` };
	}

	return planOnlyAttachments.length === 0
		? { manifest: undefined }
		: { error: `the ticket carries durable plan attachments but no ${markerName} commit marker — publish the plan again before implementing it` };
};

const readAndVerifyGeneration = async ({ settings, files, markerName }: { settings: TrackerSettings; files: GenerationFile[]; markerName: string }) => {
	const reads = await Promise.all(
		files.map(async (file) => ({
			file,
			read: await readAttachment({ settings, attachment: { id: '', title: file.title, url: file.url } }),
		})),
	);
	const verified: ReadGenerationFile[] = [];

	for (const { file, read } of reads) {
		if ('error' in read) {
			return { error: read.error };
		}

		const actual = sha256({ content: read.text });

		if (actual !== file.sha256) {
			return { error: `${file.title} does not match the SHA-256 committed by ${markerName} — publish the plan again` };
		}

		verified.push({ title: file.title, text: read.text });
	}

	return { files: verified };
};

/**
 * Every refusal path creates no plan folder, so a later successful publish can
 * be fetched instead of an incomplete folder permanently winning the disk-first
 * check.
 */
export const restorePlanWorkspace = async ({ cwd, name, identifier, settings, titlePrefix }: Params): Promise<RestoredPlanWorkspace> => {
	const listed = await getTicketAttachments({ settings, identifier });

	if ('error' in listed) {
		return { restored: [], error: listed.error };
	}

	const attachments = scopeAttachments({ attachments: listed, prefix: titlePrefix });
	const markerName = attachmentTitle({ prefix: titlePrefix, name: planAttachmentManifestName });
	// A ticket carrying only a brainstorm is a ticket with no plan, not an
	// interrupted plan upload.
	const planAttachments = attachments.filter(({ title }) => isPlanOnlyAttachmentName({ name: title }));
	const selected = selectManifestAttachment({ attachments, planOnlyAttachments: planAttachments, markerName });

	if ('error' in selected) {
		return { restored: [], error: selected.error };
	}

	if (selected.manifest === undefined) {
		return { restored: [] };
	}

	const manifestRead = await readAttachment({ settings, attachment: selected.manifest });

	if ('error' in manifestRead) {
		return { restored: [], error: manifestRead.error };
	}

	const parsed = parseAttachmentManifest({ text: manifestRead.text, markerName, isAllowedName: isPlanOnlyAttachmentName });

	if ('error' in parsed) {
		return { restored: [], error: parsed.error };
	}

	const generation = selectGeneration({ manifest: parsed.manifest, durableAttachments: planAttachments, markerName });

	if ('error' in generation) {
		return { restored: [], error: generation.error };
	}

	const read = await readAndVerifyGeneration({ settings, files: generation.files, markerName });

	if ('error' in read) {
		return { restored: [], error: read.error };
	}

	const refusal = validatePlanAttachmentGeneration({ files: read.files.map(({ title, text }) => ({ name: title, text })) });

	if (refusal !== undefined) {
		return { restored: [], error: refusal.error };
	}

	const written = await writeRestoredGeneration({ dir: await planWorkspaceDir({ cwd, name }), files: read.files });

	if (written !== undefined) {
		return { restored: [], error: written.error };
	}

	const restored = read.files.map(({ title }) => title).sort();

	return { restored, markerSha256: sha256({ content: manifestRead.text }) };
};
