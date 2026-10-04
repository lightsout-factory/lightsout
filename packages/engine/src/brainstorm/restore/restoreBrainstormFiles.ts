import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { attachmentTitle } from '#src/common/attachmentManifest/attachmentTitle.ts';
import { parseAttachmentManifest } from '#src/common/attachmentManifest/parseAttachmentManifest.ts';
import { scopeAttachments } from '#src/common/attachmentManifest/scopeAttachments.ts';
import { brainstormAttachmentFileNames } from '#src/common/constants/brainstormAttachmentFileNames.ts';
import { brainstormAttachmentManifestName } from '#src/common/constants/brainstormAttachmentManifestName.ts';
import { brainstormNotesFileName } from '#src/common/constants/brainstormNotesFileName.ts';
import { messageOf } from '#src/common/messageOf.ts';
import { pathExists } from '#src/common/paths/pathExists.ts';
import { sha256 } from '#src/common/sha256.ts';
import type { AttachmentManifest } from '#src/common/types/AttachmentManifest.ts';
import type { TrackerAttachment } from '#src/common/types/TrackerAttachment.ts';
import type { TrackerSettings } from '#src/common/types/TrackerSettings.ts';
import { planWorkspaceDir } from '#src/plan/planWorkspaceDir.ts';
import { getTicketAttachments } from '#src/ticketTracker/getTicketAttachments.ts';
import { readTicketAsset } from '#src/ticketTracker/readTicketAsset.ts';

interface Params {
	cwd: string;
	/** Kebab plan name — the folder the brainstorm's files are written into. */
	name: string;
	/** The ticket reference that folder's name carries, e.g. 'lo-117'. */
	identifier: string;
	settings: TrackerSettings;
	/** The plan id the ticket's titles for this plan are namespaced under. */
	titlePrefix: string;
}

interface RestoredBrainstormFiles {
	restored: string[];
	/** Names the ticket carried that were already on disk and were left untouched, sorted. */
	skipped: string[];
	error?: string;
}

interface ReadGenerationFile {
	title: string;
	text: string;
}

/**
 * The result is annotated rather than inferred: without it the two branches
 * widen into one shape carrying an optional `error`, and `'error' in read`
 * stops narrowing at the call site.
 */
const readAttachment = async ({
	settings,
	attachment,
}: {
	settings: TrackerSettings;
	attachment: TrackerAttachment;
}): Promise<{ text: string } | { error: string }> => {
	const text = await readTicketAsset({ settings, url: attachment.url });

	return typeof text === 'string' ? { text } : { error: `the ticket's ${attachment.title} could not be read: ${text.error}` };
};

const readGeneration = async ({
	settings,
	manifest,
	selected,
	markerName,
	required,
}: {
	settings: TrackerSettings;
	manifest: AttachmentManifest;
	selected: TrackerAttachment[];
	markerName: string;
	required: string[];
}): Promise<{ files: ReadGenerationFile[] } | { error: string }> => {
	const files: ReadGenerationFile[] = [];

	for (const listed of manifest.files) {
		const matches = selected.filter(({ title }) => title === listed.name);
		const attachment = matches.length === 1 ? matches[0] : undefined;

		if (attachment === undefined) {
			return {
				error:
					matches.length === 0
						? `${markerName} lists ${listed.name}, but the ticket carries no attachment with that title`
						: `the ticket carries more than one attachment named ${listed.name}, so ${markerName} cannot select one generation`,
			};
		}

		const read = await readAttachment({ settings, attachment });

		if ('error' in read) {
			return { error: read.error };
		}

		if (sha256({ content: read.text }) !== listed.sha256) {
			return { error: `${listed.name} does not match the SHA-256 committed by ${markerName} — publish the brainstorm again` };
		}

		files.push({ title: listed.name, text: read.text });
	}

	const missing = required.filter((name) => !files.some(({ title }) => title === name));

	return missing.length === 0
		? { files }
		: { error: `the brainstorm generation on the ticket is missing ${missing.join(', ')} — publish the brainstorm again from the machine holding the folder` };
};

/**
 * Not write-to-temp-and-rename: that needs the folder not to exist, and planning
 * has already written `facts.json` here by the time this runs.
 */
const writeIntoFolder = async ({ dir, files }: { dir: string; files: ReadGenerationFile[] }) => {
	const restored: string[] = [];
	const skipped: string[] = [];

	try {
		await mkdir(dir, { recursive: true });

		for (const { title, text } of files) {
			if (await pathExists({ path: join(dir, title) })) {
				skipped.push(title);
				continue;
			}

			await writeFile(join(dir, title), text, 'utf8');
			restored.push(title);
		}
	} catch (error) {
		return { restored: [], skipped: [], error: `the fetched brainstorm could not be written: ${messageOf({ error })}` };
	}

	return { restored: restored.sort(), skipped: skipped.sort() };
};

/**
 * Any of the generation's own names is evidence a brainstorm was published for
 * this plan, since the plan generation never carries the notes. A ticket with no
 * published brainstorm is the ordinary case and is not a failure.
 */
export const restoreBrainstormFiles = async ({ cwd, name, identifier, settings, titlePrefix }: Params): Promise<RestoredBrainstormFiles> => {
	const listed = await getTicketAttachments({ settings, identifier });

	if ('error' in listed) {
		return { restored: [], skipped: [], error: listed.error };
	}

	const attachments = scopeAttachments({ attachments: listed, prefix: titlePrefix });
	const markerName = attachmentTitle({ prefix: titlePrefix, name: brainstormAttachmentManifestName });
	const selected = attachments.filter(({ title }) => brainstormAttachmentFileNames.includes(title));
	const markers = attachments.filter(({ title }) => title === brainstormAttachmentManifestName);
	const marker = markers[0];
	if (selected.length === 0 && markers.length === 0) {
		return { restored: [], skipped: [] };
	}

	if (marker === undefined || markers.length > 1) {
		return {
			restored: [],
			skipped: [],
			error:
				marker === undefined
					? `the ticket carries brainstorm attachments but no ${markerName} commit marker — publish the brainstorm again`
					: `the ticket carries more than one ${markerName} attachment, so no single committed brainstorm generation can be selected`,
		};
	}

	const markerRead = await readAttachment({ settings, attachment: marker });

	if ('error' in markerRead) {
		return { restored: [], skipped: [], error: markerRead.error };
	}

	const parsed = parseAttachmentManifest({
		text: markerRead.text,
		markerName,
		// The list holds two bare names, so membership is already the bareness
		// guard the plan side needs `basename` for.
		isAllowedName: ({ name: listed }) => brainstormAttachmentFileNames.includes(listed),
	});

	if ('error' in parsed) {
		return { restored: [], skipped: [], error: parsed.error };
	}

	const generation = await readGeneration({
		settings,
		manifest: parsed.manifest,
		selected,
		markerName,
		// `brainstorm-decisions.json` is optional, because a plan may be shaped by a
		// brainstorm that settled no decision of its own.
		required: [brainstormNotesFileName],
	});

	if ('error' in generation) {
		return { restored: [], skipped: [], error: generation.error };
	}

	return writeIntoFolder({ dir: await planWorkspaceDir({ cwd, name }), files: generation.files });
};
