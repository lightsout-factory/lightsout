interface Params {
	label: string;
}

// Correct: two features use it, so it sits in the shared components, in the
// group for the design system's primitives.
export const StatusBadge = ({ label }: Params) => <span className="badge">{label}</span>;
