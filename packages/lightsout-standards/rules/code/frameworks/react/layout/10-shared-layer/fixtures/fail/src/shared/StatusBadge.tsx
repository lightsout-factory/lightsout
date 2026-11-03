interface Params {
	label: string;
}

// Incorrect: shared/ says only that something is shared, not what kind of code
// it is, so every shared thing of every kind ends up here.
export const StatusBadge = ({ label }: Params) => <span className="badge">{label}</span>;
