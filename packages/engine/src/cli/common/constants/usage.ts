import { renderUsage } from '#src/commands/renderUsage.ts';

/** Rendered from the command catalog so a flag cannot be documented in one place and accepted in another. */
export const usage = renderUsage();
