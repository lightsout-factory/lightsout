import { createFileRoute, notFound } from '@tanstack/react-router';
import { docPages } from '#src/features/docs/constants/docPages.ts';
import { DocNotFoundScreen } from '#src/features/docs/screens/DocNotFoundScreen.tsx';
import { DocScreen } from '#src/features/docs/screens/DocScreen.tsx';

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
