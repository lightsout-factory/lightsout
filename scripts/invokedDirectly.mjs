import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Compared through realpath on both sides: every macOS temp directory is a
 * symlink, and a plain string comparison would run nothing and exit 0 — for a
 * gate, silently passing is the worst answer available.
 *
 * @param moduleUrl - the calling module's `import.meta.url`
 */
export const invokedDirectly = ({ moduleUrl }) => {
	if (process.argv[1] === undefined) {
		return false;
	}

	try {
		return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(moduleUrl));
	} catch {
		return false;
	}
};
