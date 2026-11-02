import { AddressNotFound } from '#src/common/boundaries/AddressNotFound.tsx';

interface Props {
	library: string;
	pack: string;
}

export const PackNotFoundScreen = ({ library, pack }: Props) => (
	<AddressNotFound title="No pack at that address.">
		The library holds no pack at <span className="font-mono">{`${library}/${pack}`}</span>. Pick one from the Standards Packs page.
	</AddressNotFound>
);
