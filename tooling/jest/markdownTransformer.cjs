const { createHash } = require('node:crypto');

// The runtime half of src/markdown.d.ts: under Jest this supplies what
// esbuild's --loader:.md=text does in the bundle. ES-module-shaped so the
// default import resolves whether or not esModuleInterop is in play.
module.exports = {
	process(sourceText) {
		return { code: `module.exports = { __esModule: true, default: ${JSON.stringify(sourceText)} };\n` };
	},
	getCacheKey(sourceText) {
		return createHash('sha256').update(sourceText).digest('hex');
	},
};
