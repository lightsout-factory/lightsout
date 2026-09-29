export interface JestModuleMode {
	/** Each with its leading dot. `.js` and `.jsx` are absent because a `"type": "module"` manifest decides those per file rather than per scope, so `isEsmSourceFile` applies that rule instead. */
	esmExtensions: string[];
}
