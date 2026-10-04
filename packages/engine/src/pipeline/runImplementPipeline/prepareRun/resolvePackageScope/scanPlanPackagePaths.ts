interface Params {
	planContent: string;
	packagesDir: string;
}

/**
 * Deliberately does not judge whether a name is a real package:
 * `resolvePackageScope` drops names that match nothing. Over-inclusion only runs
 * extra gates, and scope expansion catches under-inclusion.
 */
export const scanPlanPackagePaths = ({ planContent, packagesDir }: Params): string[] | undefined => {
	const escaped = packagesDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const pattern = new RegExp(`(?:^|[^\\w@./-])${escaped}/([\\w.@-]+)/`, 'g');
	const found = [...planContent.matchAll(pattern)].map((match) => match[1]).filter((name): name is string => Boolean(name));

	return found.length > 0 ? [...new Set(found)] : undefined;
};
