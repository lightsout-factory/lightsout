interface Props {
	value: number;
	/** The largest count in the set the row belongs to — what the bar is a share of. */
	max: number;
}

/**
 * Hidden from assistive technology: the row it sits under already states the
 * count. A caller renders this only when it has rows, so `max` is never zero.
 */
export const ShareBar = ({ value, max }: Props) => (
	<span aria-hidden="true" className="block h-1.5 rounded-full bg-muted">
		{/* The width is a share of the largest bar, so it can only be a computed style. */}
		<span className="block h-1.5 rounded-full bg-status-failed" style={{ width: `${(value / max) * 100}%` }} />
	</span>
);
