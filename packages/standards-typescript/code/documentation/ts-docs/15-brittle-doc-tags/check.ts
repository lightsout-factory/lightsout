import type { RawStandardsFinding, StandardsCheckModule } from '@lightsout/standards-contracts';
import { readFileTexts } from '../../../../common/checkInput/readFileTexts.ts';
import { buildRawFinding } from '../../../../common/findings/buildRawFinding.ts';
import { isTestFile } from '../../../../common/paths/isTestFile.ts';

// Only doc-comment blocks are judged: a tag in a line comment is prose no
// tooling reads.
//
// `deprecated` is banned only without a migration path, a judgment about the
// prose beside it, and `see` only in its URL form, matched separately. The
// trailing word boundary keeps `typeParam` from reading as `type`.
//
// Written as line comments on purpose: a doc block here would carry the very
// tags it bans, and be reported by itself.
const docComment = /\/\*\*[\s\S]*?\*\//g;
const brittleTag = /@(version|since|author|type|default|readonly|private|public|protected|memberof|todo)\b/g;
const seeUrl = /@see\s[^\n]*https?:\/\//;

const getBrittleTags = ({ text }: { text: string }) => {
	const found = new Set<string>();

	for (const [comment] of text.matchAll(docComment)) {
		for (const [tag] of comment.matchAll(brittleTag)) {
			found.add(tag);
		}

		if (seeUrl.test(comment)) {
			found.add('@see with a URL');
		}
	}

	return [...found];
};

export const check: StandardsCheckModule = {
	inputKind: 'file-text',
	// TypeScript files only: in a JavaScript file a type tag is how a type is
	// declared at all. Tests are left to the test standards.
	run: ({ input }): RawStandardsFinding[] => {
		const { files, contents, standardsLibraries } = readFileTexts({ input });

		return files
			.filter((file) => /\.tsx?$/.test(file) && !isTestFile({ path: file, standardsLibraries }))
			.map((file) => {
				const tags = getBrittleTags({ text: contents.get(file) ?? '' });

				return tags.length === 0
					? undefined
					: buildRawFinding({
							rule: 'brittle-doc-tags',
							files: [{ path: file }],
							detail: `${tags.join(', ')} in a doc comment`,
							guidance: 'Delete the tag — git, TypeScript and the issue tracker already own what it records.',
						});
			})
			.filter((finding): finding is RawStandardsFinding => finding !== undefined);
	},
};
