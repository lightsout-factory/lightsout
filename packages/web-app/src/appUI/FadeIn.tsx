import { type ReactNode, useEffect, useRef, useState } from 'react';
import { cn } from '#src/common/utils/cn.ts';

interface Props {
	children: ReactNode;
	delayMs?: number;
	className?: string;
}

/**
 * Renders visible, so the content is on screen even when scripts never run; the
 * reveal is decoration. What is on screen at load eases in through CSS alone
 * (`@starting-style`, Tailwind's `starting:`), and only children off screen at
 * mount are hidden by the effect and revealed as they scroll in.
 */
export const FadeIn = ({ children, delayMs = 0, className }: Props) => {
	const [hidden, setHidden] = useState(false);
	const element = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const reduced = typeof globalThis.matchMedia === 'function' && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;
		const target = element.current;

		if (reduced || typeof globalThis.IntersectionObserver !== 'function' || target === null) {
			return;
		}

		const box = target.getBoundingClientRect();

		// On screen already: hiding it here would show as a flicker.
		if (box.top < globalThis.innerHeight && box.bottom > 0) {
			return;
		}

		setHidden(true);

		const observer = new globalThis.IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) {
					setHidden(false);
					observer.disconnect();
				}
			},
			{ threshold: 0.15, rootMargin: '0px 0px -100px 0px' },
		);

		observer.observe(target);

		return () => observer.disconnect();
	}, []);

	return (
		<div
			ref={element}
			style={{ transitionDelay: `${delayMs}ms` }}
			className={cn(
				'transition-all duration-800 ease-out motion-safe:starting:translate-y-[30px] motion-safe:starting:opacity-0',
				hidden ? 'translate-y-[30px] opacity-0' : 'translate-y-0 opacity-100',
				className,
			)}
		>
			{children}
		</div>
	);
};
