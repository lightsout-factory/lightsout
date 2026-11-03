import { builtInStandardsLibraryName } from '@lightsout/engine/contracts';
import { AddressNotFound } from '#src/components/boundaries/AddressNotFound.tsx';

interface Props {
	library: string;
	rule: string;
}

export const RuleNotFoundScreen = ({ library, rule }: Props) => (
	<AddressNotFound title="No rule at that address.">
		The <span className="font-mono">{library}</span> library holds no rule named <span className="font-mono">{rule}</span>. It may have been renamed, and these
		pages show only the {builtInStandardsLibraryName} library.
	</AddressNotFound>
);
