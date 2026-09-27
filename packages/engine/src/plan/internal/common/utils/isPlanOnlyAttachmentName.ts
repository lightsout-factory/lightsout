import { brainstormNotesFileName } from '#src/common/constants/brainstormNotesFileName.ts';
import { isDurablePlanAttachmentName } from '#src/plan/common/utils/isDurablePlanAttachmentName.ts';

/**
 * Whether an attachment title belongs to a *plan* generation.
 *
 * `brainstorm-notes.md` does not: the brainstorm generation owns it, so a ticket
 * carrying it and nothing else is a ticket with no plan rather than a
 * half-published one.
 */
export const isPlanOnlyAttachmentName = ({ name }: { name: string }): boolean => name !== brainstormNotesFileName && isDurablePlanAttachmentName({ name });
