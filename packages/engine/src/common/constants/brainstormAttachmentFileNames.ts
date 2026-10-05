import { brainstormNotesFileName } from '#src/common/constants/brainstormNotesFileName.ts';

/**
 * Not the plan's `durablePlanFileNames`: `plan draft` merges `brainstorm-decisions.json`
 * into the Decision Log, so attaching it there too would put its rows on the ticket twice.
 */
export const brainstormAttachmentFileNames: string[] = [brainstormNotesFileName, 'brainstorm-decisions.json'];
