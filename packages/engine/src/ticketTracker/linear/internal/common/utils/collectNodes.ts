import type { Connection } from '@linear/sdk';

interface Params<Node> {
	/** The first page, as the client answered it. */
	connection: Connection<Node>;
}

/**
 * A connection answers one page; a truncated backlog or blocker list would
 * silently shrink the queue or ship a dependent ahead of its blocker.
 */
export const collectNodes = async <Node>({ connection }: Params<Node>): Promise<Node[]> => {
	let page = connection;

	while (page.pageInfo.hasNextPage) {
		page = await page.fetchNext();
	}

	return page.nodes;
};
