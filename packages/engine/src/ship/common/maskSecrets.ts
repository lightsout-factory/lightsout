interface Params {
	text: string;
}

/** `git push` stderr can echo a tokenized remote, and ship persists command output into files quoted outward. */
export const maskSecrets = ({ text }: Params): string =>
	text.replaceAll(/(\/\/)[^\s/@]+(?::[^\s/@]*)?@/g, '$1***@').replaceAll(/\b(gh[pousr]|github_pat)_[A-Za-z0-9_]{16,}\b/g, '***');
