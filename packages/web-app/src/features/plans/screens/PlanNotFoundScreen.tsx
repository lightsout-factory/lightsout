import { AddressNotFound } from '#src/components/boundaries/AddressNotFound.tsx';

interface Props {
	/** The workspace name the URL carried. */
	name: string;
}

export const PlanNotFoundScreen = ({ name }: Props) => (
	<AddressNotFound title="No plan by that name.">
		Nothing under <span className="font-mono">.lightsout/plans/</span> is named <span className="font-mono">{name}</span>. Pick one from the plans list.
	</AddressNotFound>
);
