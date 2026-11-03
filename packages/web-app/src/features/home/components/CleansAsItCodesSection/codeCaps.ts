/**
 * The default pack's `folder-size` and `file-size` caps (`.tsx` files get a
 * looser one; a plain `.ts` file is what most readers meet).
 *
 * Typed here rather than read from the pack, which is too large to bundle for
 * two numbers. The section's suite holds both to the pack's own values.
 */
export const codeCaps = { folderFiles: 20, fileLines: 250 } as const;
