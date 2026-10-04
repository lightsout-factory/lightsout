import type { StandardsGroup } from '#src/common/types/StandardsGroup.ts';

interface Params<Item, Key> {
	groups: StandardsGroup[];
	/** The items one group brings in. */
	itemsOf: ({ group }: { group: StandardsGroup }) => Item[];
	/** What two groups' items are merged by. */
	keyOf: ({ item }: { item: Item }) => Key;
}

/**
 * Each item the groups bring in, once per key in first-seen order, with the
 * packages of every group that brings it in. Prose, the review and anything
 * else that says where a topic or rule applies read it from here, so they can
 * never disagree about a package set.
 */
export const collectGroupItems = <Item, Key>({ groups, itemsOf, keyOf }: Params<Item, Key>): Map<Key, { item: Item; packages: Set<string> }> => {
	const collected = new Map<Key, { item: Item; packages: Set<string> }>();

	for (const group of groups) {
		for (const item of itemsOf({ group })) {
			const key = keyOf({ item });
			const entry = collected.get(key) ?? { item, packages: new Set<string>() };

			for (const name of group.packages) {
				entry.packages.add(name);
			}

			collected.set(key, entry);
		}
	}

	return collected;
};
