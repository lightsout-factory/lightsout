/**
 * The layout and structure rules the default pack ships `advisory`, promoted
 * to `blocking` — the strict profile lightsout's own repository runs.
 *
 * The consumer repos these helpers build plant layout defects (a second export
 * in a file, a file over its cap) as work the pipeline must do, not advice it
 * may decline. The pack stopped blocking on those by default so a repository
 * adopting lightsout is not stopped on day one by a layout it has not agreed
 * to; a fixture that wants them blocking says so, the way a strict repo does.
 */
export const strictProfile: Record<string, 'blocking'> = {
	'prefer-functions': 'blocking',
	'banned-folder-name': 'blocking',
	'named-string-values': 'blocking',
	'index-file-contents': 'blocking',
	'class-inheritance': 'blocking',
	'file-directly-in-common': 'blocking',
	'file-size': 'blocking',
	'index-files': 'blocking',
	'import-path-alias': 'blocking',
	'internal-import-from-outside': 'blocking',
	'multi-export': 'blocking',
	'single-use-scalar': 'blocking',
	'test-beside-subject': 'blocking',
	'test-file-size': 'blocking',
	'test-manual-mock-cleanup': 'blocking',
	'test-support-in-src': 'blocking',
};
