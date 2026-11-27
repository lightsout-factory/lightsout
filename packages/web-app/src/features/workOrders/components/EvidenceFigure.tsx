import { type EvidenceCount, EvidenceProvenance } from '@lightsout/engine/contracts';

interface Props {
	label: string;
	count: EvidenceCount;
	/** The value as shown, e.g. `formatCost`'s answer; defaults to the plain number. */
	text?: string;
}

/** A tick is earned only by a figure the engine measured itself; an agent's word never carries one. */
export const EvidenceFigure = ({ label, count, text }: Props) => (
	<div className="flex items-baseline gap-2 text-sm">
		<span className="text-muted-foreground">{label}</span>
		<span className="font-semibold">{text ?? count.value}</span>
		{count.provenance === EvidenceProvenance.Measured ? (
			<span role="img" aria-label="measured" title="Measured by the engine" className="text-drop-navy">
				✓
			</span>
		) : null}
	</div>
);
