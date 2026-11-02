import { ChevronDown } from 'lucide-react';
import { Markdown } from '#src/common/content/Markdown/Markdown.tsx';
import { SitePageFrame } from '#src/common/site/SitePageFrame.tsx';
import { DocNav } from '#src/docs/DocScreen/DocNav.tsx';
import { DocToc } from '#src/docs/DocScreen/DocToc.tsx';
import { resolveDocHref } from '#src/docs/DocScreen/resolveDocHref.ts';
import { splitDocTitle } from '#src/docs/DocScreen/splitDocTitle.ts';
import { docPages } from '#src/docs/docPages.ts';

interface Props {
	doc: string;
}

/**
 * Three columns on a wide screen — the docs, the article, and where you are in
 * it — so a long reference reads at a comfortable width with its contents in
 * reach. On a narrower one the contents fold into a list above the article.
 * An unknown name renders nothing: the route answers it with its own
 * not-found panel before this is reached.
 */
export const DocScreen = ({ doc }: Props) => {
	const page = docPages[doc];

	if (page === undefined) {
		return null;
	}

	const { title, body } = splitDocTitle({ text: page.text });

	return (
		<SitePageFrame>
			<div className="grid grid-cols-1 gap-10 lg:grid-cols-[11rem_minmax(0,1fr)] xl:grid-cols-[11rem_minmax(0,1fr)_14rem]">
				<aside className="lg:sticky lg:top-24 lg:self-start">
					<DocNav current={doc} />
				</aside>
				<article className="min-w-0 max-w-3xl">
					<h1 className="mb-8 font-extrabold text-4xl text-drop-navy tracking-tight md:text-5xl">{title ?? page.title}</h1>
					<details className="group mb-8 rounded-xl border border-border bg-card px-4 py-3 xl:hidden">
						<summary className="flex cursor-pointer select-none list-none items-center justify-between font-semibold text-drop-navy text-sm">
							On this page
							<ChevronDown aria-hidden="true" className="size-4 transition-transform group-open:rotate-180" />
						</summary>
						<div className="mt-4">
							<DocToc text={body} />
						</div>
					</details>
					<Markdown text={body} variant="article" resolveHref={resolveDocHref} />
				</article>
				<aside className="hidden xl:sticky xl:top-24 xl:block xl:max-h-[calc(100vh-8rem)] xl:self-start xl:overflow-y-auto">
					<DocToc text={body} />
				</aside>
			</div>
		</SitePageFrame>
	);
};
