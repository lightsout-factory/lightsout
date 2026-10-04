/**
 * Clamped because a narrow terminal would wrap file paths into confetti and a
 * wide one makes lines too long to read. Piped output reports no width.
 */
export const terminalWidth = (): number => {
	const narrowest = 60;
	const widest = 120;

	return Math.min(Math.max(process.stdout.columns ?? 100, narrowest), widest);
};
