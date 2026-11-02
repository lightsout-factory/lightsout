import { createFileRoute, notFound } from '@tanstack/react-router';
import { DocNotFoundScreen } from '#src/docs/DocNotFoundScreen.tsx';
import { DocScreen } from '#src/docs/DocScreen/DocScreen.tsx';
import { docPages } from '#src/docs/docPages.ts';

const DocRoutePage = () => {
	const { doc } = Route.useParams();

	return <DocScreen doc={doc} />;
};

export const Route = createFileRoute('/_site/docs/$doc')({
	loader: ({ params }) => {
		if (docPages[params.doc] === undefined) {
			throw notFound();
		}
	},
	head: ({ params }) => ({ meta: [{ title: `${docPages[params.doc]?.title ?? 'Docs'} — lightsout` }] }),
	component: DocRoutePage,
	notFoundComponent: DocNotFoundScreen,
});
