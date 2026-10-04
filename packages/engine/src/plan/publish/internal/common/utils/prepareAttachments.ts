import { readFile } from 'node:fs/promises';
import { serializeAttachmentManifest } from '#src/common/attachmentManifest/serializeAttachmentManifest.ts';
import { brainstormNotesFileName } from '#src/common/constants/brainstormNotesFileName.ts';
import { messageOf } from '#src/common/messageOf.ts';
import { planAttachmentManifestName } from '#src/plan/common/constants/planAttachmentManifestName.ts';
import type { DurablePlanFile } from '#src/plan/internal/common/types/DurablePlanFile.ts';
import { validatePlanAttachmentGeneration } from '#src/plan/internal/common/validatePlanAttachmentGeneration.ts';
import type { PreparedAttachment } from '#src/plan/publish/internal/common/types/PreparedAttachment.ts';

interface Params {
	files: DurablePlanFile[];
}

/** Reads a complete snapshot before the first outward mutation, so the manifest commits exactly those bytes. */
export const prepareAttachments = async ({ files }: Params): Promise<{ attachments: PreparedAttachment[] } | { error: string }> => {
	const durable: PreparedAttachment[] = [];
	// The brainstorm generation owns `brainstorm-notes.md` outright, so the plan
	// generation neither sends it nor commits it.
	const carried = files.filter(({ name }) => name !== brainstormNotesFileName);

	for (const file of carried) {
		try {
			durable.push({ name: file.name, content: await readFile(file.path) });
		} catch (error) {
			return { error: `could not read ${file.name} before publishing: ${messageOf({ error })}` };
		}
	}

	const refusal = validatePlanAttachmentGeneration({ files: durable.map(({ name, content }) => ({ name, text: content.toString('utf8') })) });

	if (refusal !== undefined) {
		return refusal;
	}

	return {
		attachments: [...durable, { name: planAttachmentManifestName, content: serializeAttachmentManifest({ files: durable }) }],
	};
};
