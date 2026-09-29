import { BookOpen } from 'lucide-react';
import { PageHeader } from '#src/appUI/headers/PageHeader.tsx';
import { Markdown } from '#src/appUI/Markdown.tsx';
import { docPages } from '#src/features/docs/common/constants/docPages.ts';
import { DocToc } from '#src/features/docs/screens/DocPage/internal/components/DocToc.tsx';

interface Props {
	doc: string;
}

/** An unknown name renders nothing: the route answers it with its own not-found panel before this is reached. */
export const DocPage = ({ doc }: Props) => {
	const page = docPages[doc];

	return page === undefined ? null : (
		<div className="flex flex-col gap-6 p-6">
			<PageHeader icon={BookOpen} title={page.title} />
			<DocToc text={page.text} />
			<div className="max-w-3xl">
				<Markdown text={page.text} />
			</div>
		</div>
	);
};
