import { createFileRoute, Link, notFound } from '@tanstack/react-router';
import { AddressNotFound } from '#src/common/boundaries/AddressNotFound.tsx';
import { DocScreen } from '#src/docs/DocScreen/DocScreen.tsx';
import { docPages } from '#src/docs/docPages.ts';

/** There is no docs index, so the way out is the configuration doc, which the site bar's Docs entry also points at. */
const DocNotFound = () => (
	<AddressNotFound title="No doc at that address.">
		That doc does not exist —{' '}
		<Link to="/docs/$doc" params={{ doc: 'configuration' }} className="text-brand-to underline underline-offset-4">
			read the configuration doc
		</Link>
		.
	</AddressNotFound>
);

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
	notFoundComponent: DocNotFound,
});
