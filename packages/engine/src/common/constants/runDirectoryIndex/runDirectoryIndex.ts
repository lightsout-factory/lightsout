import { RunDirectoryIndex } from '#src/runState/common/constants/runDirectoryIndex/RunDirectoryIndex.ts';

/** A single shared instance is what makes "searched once per process" true. */
export const runDirectoryIndex = new RunDirectoryIndex();
