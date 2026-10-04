import { describe, expect, test } from '@jest/globals';
import { type StandardsCheckInput, StandardsInputKind } from '@lightsout/standards-contracts';
import { buildCheckInputs } from '#src/standardsCheck/common/buildCheckInputs.ts';

const paths = { cwd: '/repo', source: ['src/a.ts'], tests: [], files: ['src/a.ts'], referenceFiles: [], standardsLibraries: [] };

/** A builder that answers the two path-carrying kinds and records which kinds it was asked for. */
const setupBuilder = () => {
	const asked: StandardsInputKind[] = [];
	const built: Partial<Record<StandardsInputKind, StandardsCheckInput>> = {
		[StandardsInputKind.FileList]: { kind: StandardsInputKind.FileList, ...paths, dependencies: new Map() },
		[StandardsInputKind.FileText]: { kind: StandardsInputKind.FileText, ...paths, contents: new Map([['src/a.ts', 'export const a = 1;']]) },
	};
	const inputFor = async ({ kind }: { kind: StandardsInputKind }) => {
		asked.push(kind);

		const input = built[kind];

		if (input === undefined) {
			throw new Error(`no input built for ${kind}`);
		}

		return input;
	};

	return { asked, built, inputFor };
};

describe('buildCheckInputs', () => {
	test('hands back one entry per declared kind, each under its own key, and asks for nothing else', async () => {
		const { asked, built, inputFor } = setupBuilder();

		const inputs = await buildCheckInputs({ kinds: [StandardsInputKind.FileText, StandardsInputKind.FileList], inputFor });

		expect(inputs).toStrictEqual({ [StandardsInputKind.FileList]: built['file-list'], [StandardsInputKind.FileText]: built['file-text'] });
		expect(asked).toStrictEqual([StandardsInputKind.FileText, StandardsInputKind.FileList]);
	});

	test('a check declaring one kind is handed that kind alone', async () => {
		const { built, inputFor } = setupBuilder();

		const inputs = await buildCheckInputs({ kinds: [StandardsInputKind.FileList], inputFor });

		expect(inputs).toStrictEqual({ [StandardsInputKind.FileList]: built['file-list'] });
	});
});
