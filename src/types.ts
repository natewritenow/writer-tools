import type { TAbstractFile, TFolder } from 'obsidian';

export type NewItemPlacement = 'top' | 'bottom';

export type MoveDirection = 'up' | 'down' | 'top' | 'bottom';

export type InsertPosition = 'before' | 'after';

export interface ParentOrder {
	customOrder: string[];
}

export interface ReorderSettings {
	enabled: boolean;
	newItemPlacement: NewItemPlacement;
	folders: Record<string, ParentOrder>;
}

export const ROOT_PATH = '/';

export const DEFAULT_SETTINGS: ReorderSettings = {
	enabled: true,
	newItemPlacement: 'bottom',
	folders: {},
};

export interface FileTreeItem {
	file: TAbstractFile;
	el?: HTMLElement;
}

export interface FolderTreeItem extends FileTreeItem {
	setCollapsed(collapsed: boolean, animate?: boolean): Promise<void>;
}

export interface FileExplorerTree {
	selectedDoms: Array<{ file: TAbstractFile; el: HTMLElement }>;
}

/** Minimal typings for undocumented FileExplorerView internals. */
export interface FileExplorerView {
	sort(): void;
	getSortedFolderItems(folder: TFolder): FileTreeItem[];
	fileItems: Record<string, FileTreeItem>;
	files: Map<HTMLElement, TAbstractFile>;
	tree: FileExplorerTree;
	lastDropTargetEl: HTMLElement | null;
}
