import type { TFolder } from 'obsidian';
import type WriterToolsPlugin from './main';
import type { FileExplorerView } from './types';

export class Patcher {
	private unpatchExplorer: (() => void) | null = null;

	constructor(private readonly plugin: WriterToolsPlugin) {}

	patchExplorer(): boolean {
		this.unpatch();

		const view = this.plugin.getExplorerView();
		if (!view) return false;

		const explorerProto = Object.getPrototypeOf(view) as FileExplorerView;
		if (typeof explorerProto.getSortedFolderItems !== 'function') {
			return false;
		}

		const plugin = this.plugin;
		const originalGetSortedFolderItems = explorerProto.getSortedFolderItems;

		explorerProto.getSortedFolderItems = function (
			this: FileExplorerView,
			folder: TFolder,
		) {
			const originalSorted = originalGetSortedFolderItems.call(this, folder);
			if (!plugin.settings.enabled) return originalSorted;
			return plugin.orderManager.getSortedItems(folder.path, originalSorted);
		};

		this.unpatchExplorer = () => {
			explorerProto.getSortedFolderItems = originalGetSortedFolderItems;
		};

		return true;
	}

	unpatch() {
		this.unpatchExplorer?.();
		this.unpatchExplorer = null;
	}
}
