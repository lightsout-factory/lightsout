import { Check, Copy } from 'lucide-react';
import { type ComponentProps, useEffect, useState } from 'react';
import { Button } from '#src/appUI/buttons/Button.tsx';

interface Props {
	value: string;
	/** Always names what will be copied, since several of these can sit on one page. */
	label: string;
	variant?: ComponentProps<typeof Button>['variant'];
	/** Shows the icon alone; the label stays the accessible name. */
	isLabelHidden?: boolean;
	className?: string;
}

/**
 * A browser that refuses the clipboard — an insecure origin, a denied
 * permission — leaves the label where it was rather than throwing into the
 * render tree.
 */
export const CopyButton = ({ value, label, variant = 'ghost', isLabelHidden = false, className }: Props) => {
	const [copied, setCopied] = useState(false);

	useEffect(() => {
		if (!copied) {
			return;
		}

		const timer = setTimeout(() => setCopied(false), 1_500);

		return () => clearTimeout(timer);
	}, [copied]);

	const copy = async () => {
		const written = await navigator.clipboard.writeText(value).then(
			() => true,
			() => false,
		);

		setCopied(written);
	};

	const text = copied ? 'Copied' : label;
	const Icon = copied ? Check : Copy;

	return (
		<Button
			type="button"
			variant={variant}
			size={isLabelHidden ? 'icon' : 'sm'}
			aria-label={isLabelHidden ? text : undefined}
			className={className}
			onClick={() => void copy()}
		>
			<Icon className="size-3.5" />
			{isLabelHidden ? null : text}
		</Button>
	);
};
