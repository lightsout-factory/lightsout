export interface FileExport {
	/** `const`, `class`, `function`, `interface`, `type` or `enum`. */
	keyword: string;
	name: string;
	/** The whole line, for the rules that must read what else the declaration says. */
	line: string;
}
