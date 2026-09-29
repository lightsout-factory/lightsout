/**
 * Spelled in Claude Code's tool names, the only harness that can express a
 * built-in allowlist; another harness maps them in its own arg builder. The set
 * is exactly what the focused role prompt tells a writer to do.
 */
export const planWriterTools: string[] = ['Bash', 'Edit', 'Glob', 'Grep', 'Read', 'Write'];
