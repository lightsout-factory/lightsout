import { brainstormNotesFileName } from '#src/common/constants/brainstormNotesFileName.ts';
import { isDurablePlanAttachmentName } from '#src/plan/common/utils/isDurablePlanAttachmentName.ts';

/** `brainstorm-notes.md` belongs to the brainstorm generation, so a ticket carrying only it has no plan rather than a half-published one. */
export const isPlanOnlyAttachmentName = ({ name }: { name: string }): boolean => name !== brainstormNotesFileName && isDurablePlanAttachmentName({ name });
