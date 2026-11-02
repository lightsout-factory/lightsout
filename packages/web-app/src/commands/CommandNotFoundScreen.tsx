import { Link } from '@tanstack/react-router';
import { AddressNotFound } from '#src/common/boundaries/AddressNotFound.tsx';

interface Props {
	/** The word the URL named, which the catalog carries no command for. */
	command: string;
}

export const CommandNotFoundScreen = ({ command }: Props) => (
	<AddressNotFound title="No command by that name.">
		lightsout has no command called <span className="font-mono">{command}</span> —{' '}
		<Link to="/commands" className="text-brand-to underline underline-offset-4">
			pick one from the commands list
		</Link>
		.
	</AddressNotFound>
);
