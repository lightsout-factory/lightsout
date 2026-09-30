/**
 * JavaScript allows throwing any value, not just an Error, so a script's report
 * reads the message when there is one and the value itself otherwise.
 *
 * @param error - whatever was caught
 */
export const messageOf = ({ error }) => (error instanceof Error ? error.message : String(error));
