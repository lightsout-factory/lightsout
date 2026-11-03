interface Params {
	label: string;
}

// The badge was written for issues, and billing reached in for it.
export const StatusBadge = ({ label }: Params) => <span className="badge">{label}</span>;
