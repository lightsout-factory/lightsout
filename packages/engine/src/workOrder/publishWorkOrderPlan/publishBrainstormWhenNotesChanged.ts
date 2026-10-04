import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { publishBrainstorm } from '#src/brainstorm/publish/publishBrainstorm.ts';
import { attachmentTitle } from '#src/common/attachmentManifest/attachmentTitle.ts';
import { parseAttachmentManifest } from '#src/common/attachmentManifest/parseAttachmentManifest.ts';
import { scopeAttachments } from '#src/common/attachmentManifest/scopeAttachments.ts';
import { brainstormAttachmentFileNames } from '#src/common/constants/brainstormAttachmentFileNames.ts';
import { brainstormAttachmentManifestName } from '#src/common/constants/brainstormAttachmentManifestName.ts';
import { brainstormNotesFileName } from '#src/common/constants/brainstormNotesFileName.ts';
import { sha256 } from '#src/common/sha256.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { pathExists } from '#src/plan/common/paths/pathExists.ts';
import { planWorkspaceDir } from '#src/plan/planWorkspaceDir.ts';
import { getTicketAttachments } from '#src/ticketTracker/getTicketAttachments.ts';
import { readTicketAsset } from '#src/ticketTracker/readTicketAsset.ts';
import type { TicketTrackerTarget } from '#src/workOrder/common/types/TicketTrackerTarget.ts';

interface Params {
	cwd: string;
	/** `<ticket-branch>/<plan-id>`. */
	address: string;
	planId: string;
	target: TicketTrackerTarget;
	config: LightsoutConfig;
	env: NodeJS.ProcessEnv;
	onProgress?: (message: string) => void;
}

const readCommittedNotesHash = async ({
	planId,
	target,
}: {
	planId: string;
	target: TicketTrackerTarget;
}): Promise<{ committed: string | undefined } | { error: string }> => {
	const { settings, ticketRef } = target;
	const attachments = await getTicketAttachments({ settings, identifier: ticketRef });

	if ('error' in attachments) {
		return { error: `the brainstorm generation on ${ticketRef} could not be read: ${attachments.error}` };
	}

	const scoped = scopeAttachments({ attachments, prefix: planId });
	const markers = scoped.filter(({ title }) => title === brainstormAttachmentManifestName);
	const marker = markers.length === 1 ? markers[0] : undefined;

	if (marker === undefined) {
		return { committed: undefined };
	}

	const text = await readTicketAsset({ settings, url: marker.url });

	if (typeof text !== 'string') {
		return { error: `the brainstorm generation on ${ticketRef} could not be read: ${text.error}` };
	}

	const parsed = parseAttachmentManifest({
		text,
		markerName: attachmentTitle({ prefix: planId, name: brainstormAttachmentManifestName }),
		isAllowedName: ({ name }) => brainstormAttachmentFileNames.includes(name),
	});

	// A marker that will not parse is healed by republishing over it, because
	// every title it names is replaced by the same publish.
	return { committed: 'error' in parsed ? undefined : parsed.manifest.files.find(({ name }) => name === brainstormNotesFileName)?.sha256 };
};

/**
 * `brainstorm-notes.md` belongs to the brainstorm generation, so a plan publish
 * would otherwise leave stale notes on the ticket. Only differing bytes are
 * republished, so `plan publish` does not re-upload the notes every run.
 */
export const publishBrainstormWhenNotesChanged = async ({
	cwd,
	address,
	planId,
	target,
	config,
	env,
	onProgress,
}: Params): Promise<{ published: string[] } | { error: string }> => {
	const notesPath = join(await planWorkspaceDir({ cwd, name: address }), brainstormNotesFileName);

	if (!(await pathExists({ path: notesPath }))) {
		return { published: [] };
	}

	const committed = await readCommittedNotesHash({ planId, target });

	if ('error' in committed) {
		return committed;
	}

	const onDisk = sha256({ content: await readFile(notesPath) });

	if (committed.committed === onDisk) {
		return { published: [] };
	}

	const report = await publishBrainstorm({ cwd, name: address, config, env, onProgress: onProgress ?? (() => undefined), titlePrefix: planId });

	return report.error === undefined ? { published: report.published } : { error: report.error };
};
