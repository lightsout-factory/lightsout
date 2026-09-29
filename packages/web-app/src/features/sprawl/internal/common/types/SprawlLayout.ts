import type { SprawlBar } from '#src/features/sprawl/internal/common/types/SprawlBar.ts';
import type { SprawlFolderRow } from '#src/features/sprawl/internal/common/types/SprawlFolderRow.ts';

export interface SprawlLayout {
	bars: SprawlBar[];
	folderRows: SprawlFolderRow[];
	/** Where the file cap sits on the bar scale. */
	capY: number;
	/** Where the folder-census cap sits across a folder row. */
	censusX: number;
	/** The top of the folder strip, where the census line starts; the foot of the box when there are no folders yet. */
	censusY: number;
}
