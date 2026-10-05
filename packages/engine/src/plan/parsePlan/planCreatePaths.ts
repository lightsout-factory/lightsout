import { pathFromLine } from '#src/plan/parsePlan/common/pathFromLine.ts';

interface Params {
	planText: string;
}

export const planCreatePaths = ({ planText }: Params): string[] => {
	const paths: string[] = [];
	let inCreateSection = false;

	for (const line of planText.split('\n')) {
		const heading = /^##\s+(.+?)\s*$/.exec(line);

		if (heading) {
			inCreateSection = heading[1] === 'Files to Create';

			continue;
		}

		if (inCreateSection && /^###\s+/.test(line)) {
			const path = pathFromLine({ line });

			if (path) {
				paths.push(path);
			}
		}
	}

	return paths;
};
