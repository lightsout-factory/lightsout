interface Params {
	label: string;
}

// Correct: what two features need sits in the shared layer.
export const StatusBadge = ({ label }: Params) => <span className="badge">{label}</span>;
