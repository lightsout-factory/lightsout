import * as TabsPrimitive from '@radix-ui/react-tabs';
import { File, Folder } from 'lucide-react';
import type { ReactNode } from 'react';
import { toFileTreeRows } from '#src/common/utils/toFileTreeRows.ts';

interface Props {
	/** Each file's path and what opening it shows. */
	files: Array<{ path: string; content: ReactNode }>;
	/** The file open first. */
	defaultPath: string;
	/** What the tree is, for a screen reader — "Incorrect files". */
	label: string;
}

/**
 * A small source tree: its folders and files on the left, the open file on the
 * right, stacked on a narrow screen.
 *
 * Built on the tab primitive, so the files are a real tab list — arrow keys move
 * between them and a screen reader hears which is open. Folders are labels in
 * that list rather than tabs: nothing opens a folder.
 */
export const FileTree = ({ files, defaultPath, label }: Props) => (
	<TabsPrimitive.Root
		defaultValue={files.some((file) => file.path === defaultPath) ? defaultPath : files[0]?.path}
		orientation="vertical"
		className="grid grid-cols-1 overflow-hidden rounded-lg border border-border md:grid-cols-[13rem_minmax(0,1fr)]"
	>
		<TabsPrimitive.List aria-label={label} className="flex flex-col gap-0.5 border-border border-b bg-muted/40 p-2 md:border-r md:border-b-0">
			{toFileTreeRows({ paths: files.map((file) => file.path) }).map(({ key, name, depth, path }) =>
				path === undefined ? (
					<span
						key={key}
						className="flex items-center gap-1.5 px-2 py-1 font-mono text-subtle-foreground text-xs"
						style={{ paddingLeft: `${0.5 + depth * 0.75}rem` }}
					>
						<Folder aria-hidden="true" className="size-3.5 shrink-0" />
						{name}
					</span>
				) : (
					<TabsPrimitive.Trigger
						key={key}
						value={path}
						title={path}
						className="flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-left font-mono text-muted-foreground text-xs transition-colors hover:bg-muted hover:text-foreground data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm"
						style={{ paddingLeft: `${0.5 + depth * 0.75}rem` }}
					>
						<File aria-hidden="true" className="size-3.5 shrink-0" />
						<span className="truncate">{name}</span>
					</TabsPrimitive.Trigger>
				),
			)}
		</TabsPrimitive.List>
		{files.map((file) => (
			<TabsPrimitive.Content key={file.path} value={file.path} className="min-w-0 outline-none">
				{file.content}
			</TabsPrimitive.Content>
		))}
	</TabsPrimitive.Root>
);
