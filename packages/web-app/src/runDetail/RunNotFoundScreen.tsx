import { AddressNotFound } from '#src/common/boundaries/AddressNotFound.tsx';

interface Props {
	/** The id the URL carried, which nothing on disk answers to. */
	runId: string;
}

export const RunNotFoundScreen = ({ runId }: Props) => (
	<AddressNotFound title="No run matching that id.">
		Nothing on disk answers to <span className="font-mono">{runId}</span>. Pick one from the runs list.
	</AddressNotFound>
);
