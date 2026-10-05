import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { attachmentTitle } from '#src/common/attachmentManifest/attachmentTitle.ts';
import { serializeAttachmentManifest } from '#src/common/attachmentManifest/serializeAttachmentManifest.ts';
import { brainstormAttachmentFileNames } from '#src/common/constants/brainstormAttachmentFileNames.ts';
import { brainstormAttachmentManifestName } from '#src/common/constants/brainstormAttachmentManifestName.ts';
import { brainstormNotesFileName } from '#src/common/constants/brainstormNotesFileName.ts';
import { messageOf } from '#src/common/messageOf.ts';
import { workOrderNameOf } from '#src/common/planAddress/workOrderNameOf.ts';
import type { TrackerSettings } from '#src/common/types/TrackerSettings.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { planWorkspaceDir } from '#src/plan/planWorkspaceDir.ts';
import { readPlanWorkOrderRef } from '#src/plan/readPlanWorkOrderRef.ts';
import { getTicketsByIdentifiers } from '#src/ticketTracker/getTicketsByIdentifiers.ts';
import { resolveTrackerSettings } from '#src/ticketTracker/resolveTrackerSettings.ts';
import { setTicketAttachment } from '#src/ticketTracker/setTicketAttachment.ts';

interface Params {
	cwd: string;
	/** The plan address `<work-order>/<plan-id>` — it names the folder the brainstorm's own files live in and the work order whose ticket they publish to. */
	name: string;
	config: LightsoutConfig;
	env: NodeJS.ProcessEnv;
	onProgress: (message: string) => void;
	/** The plan id every attachment title is namespaced under. */
	titlePrefix: string;
}

interface BrainstormPublishReport {
	/** Absent when nothing was published. */
	ticketRef?: string;
	/** Ends with the generation commit marker. */
	published: string[];
	error?: string;
}

interface PreparedAttachment {
	name: string;
	content: Buffer;
}

/** The tracker previews an attachment by its content type, and this generation holds only these two shapes. */
const contentTypeOf = ({ name }: { name: string }) => (name.endsWith('.json') ? 'application/json' : 'text/markdown');

/**
 * Read as one snapshot before any outward mutation, so the marker commits
 * exactly those bytes. Only the notes are required: a brainstorm may settle no
 * decision of its own.
 */
const prepareAttachments = async ({ dir }: { dir: string }): Promise<{ attachments: PreparedAttachment[] } | { error: string }> => {
	const files: PreparedAttachment[] = [];

	for (const name of brainstormAttachmentFileNames) {
		const content = await readFile(join(dir, name)).catch((error: unknown) => ({ error: messageOf({ error }) }));
		const optional = name !== brainstormNotesFileName;

		if (Buffer.isBuffer(content)) {
			files.push({ name, content });
		} else if (!optional) {
			return { error: `could not read ${name} from ${dir} — run the \`brainstorm\` skill first: ${content.error}` };
		}
	}

	return { attachments: [...files, { name: brainstormAttachmentManifestName, content: serializeAttachmentManifest({ files }) }] };
};

/** Attach the prepared snapshot in order, with its marker last, stopping at the first tracker refusal. */
const attachBrainstormFiles = async ({
	settings,
	ticketId,
	ticketRef,
	attachments,
	onProgress,
	titlePrefix,
}: {
	settings: TrackerSettings;
	ticketId: string;
	ticketRef: string;
	attachments: PreparedAttachment[];
	onProgress: (message: string) => void;
	titlePrefix: string;
}) => {
	const published: string[] = [];

	for (const attachment of attachments) {
		const title = attachmentTitle({ prefix: titlePrefix, name: attachment.name });
		const failure = await setTicketAttachment({
			settings,
			ticketId,
			title,
			content: attachment.content,
			contentType: contentTypeOf({ name: attachment.name }),
		});

		// A stopped loop keeps what did land, so a partial publish is visible
		// rather than silent.
		if (failure !== undefined) {
			return { published, error: failure.error };
		}

		published.push(title);
		onProgress(`attached ${title} to ${ticketRef}`);
	}

	return { published, error: undefined };
};

/**
 * Refusals run disk, record, configuration, then network, so the common
 * failures are answered with no round trip.
 *
 * A republish without `brainstorm-decisions.json` leaves the earlier copy on the
 * ticket; restore ignores it because the marker written last does not list it.
 */
export const publishBrainstorm = async ({ cwd, name, config, env, onProgress, titlePrefix }: Params): Promise<BrainstormPublishReport> => {
	const prepared = await prepareAttachments({ dir: await planWorkspaceDir({ cwd, name }) });

	if ('error' in prepared) {
		return { published: [], error: prepared.error };
	}

	const ticketRef = await readPlanWorkOrderRef({ cwd, name });

	if (ticketRef === undefined) {
		return {
			published: [],
			error: `the brainstorm for '${name}' cannot be published: work order '${workOrderNameOf({ name })}' carries no ticket reference in its record, so it belongs to no ticket`,
		};
	}

	const settings = resolveTrackerSettings({ config, env });

	if ('error' in settings) {
		return { ticketRef, published: [], error: settings.error };
	}

	const tickets = await getTicketsByIdentifiers({ settings, identifiers: [ticketRef] });

	if ('error' in tickets) {
		return { ticketRef, published: [], error: tickets.error };
	}

	const ticket = tickets.at(0);

	if (ticket === undefined) {
		return { ticketRef, published: [], error: `there is no ${ticketRef} on the configured ticket tracker` };
	}

	const { published, error } = await attachBrainstormFiles({
		settings,
		ticketId: ticket.id,
		ticketRef,
		attachments: prepared.attachments,
		onProgress,
		titlePrefix,
	});

	return error === undefined ? { ticketRef, published } : { ticketRef, published, error };
};
