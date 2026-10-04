import type { RawStandardsFinding } from '@lightsout/standards-contracts';
import { buildRawFinding } from '#common/findings/buildRawFinding.ts';
import { getBaseName } from '#common/paths/getBaseName.ts';
import { getDirectory } from '#common/paths/getDirectory.ts';
import { CodeKind } from './CodeKind.ts';
import { getCodeKind } from './getCodeKind.ts';

interface Params {
	/** Every source file to judge: no tests, no index files. */
	files: string[];
	contents: Map<string, string>;
}

/** The folder of a `common/` each kind of code goes in; a function sits in `common/` itself. */
const folderByKind: Record<CodeKind, string> = { [CodeKind.Function]: 'common', [CodeKind.Type]: 'types', [CodeKind.Constant]: 'constants' };

const guidanceByKind: Record<CodeKind, string> = {
	[CodeKind.Function]: 'Move it directly into `common/`: only types and constants have a folder of their own.',
	[CodeKind.Type]: 'Move it to `common/types/`.',
	[CodeKind.Constant]: 'Move it to `common/constants/`.',
};

/** The folder of a `common/` a file sits in, when it sits directly in the `common/` or in its `types/` or `constants/`. */
const getCommonSlot = ({ file }: { file: string }) => {
	const parent = getDirectory({ path: file });
	const name = getBaseName({ path: parent });
	const isKindFolder = (name === 'types' || name === 'constants') && getBaseName({ path: getDirectory({ path: parent }) }) === 'common';

	return name === 'common' || isKindFolder ? name : undefined;
};

/** A type or constant sitting directly in a `common/`, and any file in `types/` or `constants/` that holds another kind of code. */
export const findMisfiledFiles = ({ files, contents }: Params): RawStandardsFinding[] =>
	files.flatMap((file) => {
		const slot = getCommonSlot({ file });
		const kind = getCodeKind({ text: contents.get(file) ?? '' });

		if (slot === undefined || kind === undefined || folderByKind[kind] === slot) {
			return [];
		}

		return [
			buildRawFinding({
				rule: 'common-folder-layout',
				files: [{ path: file }],
				detail: `'${getBaseName({ path: file })}' holds a ${kind} and sits ${slot === 'common' ? 'directly in' : 'in'} ${getDirectory({ path: file })}`,
				guidance: guidanceByKind[kind],
			}),
		];
	});
