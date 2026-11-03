import { Link } from '@tanstack/react-router';
import { AddressNotFound } from '#src/components/boundaries/AddressNotFound.tsx';

/** There is no docs index, so the way out is the configuration doc, which the site bar's Docs entry also points at. */
export const DocNotFoundScreen = () => (
	<AddressNotFound title="No doc at that address.">
		That doc does not exist —{' '}
		<Link to="/docs/$doc" params={{ doc: 'configuration' }} className="text-brand-to underline underline-offset-4">
			read the configuration doc
		</Link>
		.
	</AddressNotFound>
);
