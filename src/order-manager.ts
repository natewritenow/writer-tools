import { TAbstractFile, TFolder } from 'obsidian';
import type WriterToolsPlugin from './main';
import { getName, getParentPath, normalizeParentPath } from './paths';
import {
	type FileTreeItem,
	type InsertPosition,
	type MoveDirection,
	type ParentOrder,
	ROOT_PATH,
} from './types';

const collator = new Intl.Collator(undefined, {
	sensitivity: 'base',
	numeric: true,
});

function emptyParentOrder(): ParentOrder {
	return { customOrder: [] };
}

export class OrderManager {
	constructor(private readonly plugin: WriterToolsPlugin) {}

	syncItems(root = this.plugin.app.vault.getRoot()) {
		this.cleanUpInvalidPaths();
		this.syncFolder(root);
		void this.plugin.saveSettings();
	}

	add(item: TAbstractFile) {
		const parentPath = normalizeParentPath(item.parent?.path ?? ROOT_PATH);
		const parentOrder = this.ensureParentOrder(parentPath);

		if (parentOrder.customOrder.includes(item.name)) return;

		const placement = this.plugin.settings.newItemPlacement;

		if (placement === 'top') {
			parentOrder.customOrder.unshift(item.name);
		} else {
			parentOrder.customOrder.push(item.name);
		}

		if (item instanceof TFolder) {
			this.ensureParentOrder(item.path);
		}

		void this.plugin.saveSettings();
	}

	rename(oldPath: string, newPath: string) {
		const folders = this.plugin.settings.folders;
		const oldParentPath = normalizeParentPath(getParentPath(oldPath));
		const newParentPath = normalizeParentPath(getParentPath(newPath));
		const oldName = getName(oldPath);
		const newName = getName(newPath);

		if (folders[oldPath]) {
			folders[newPath] = folders[oldPath];
			delete folders[oldPath];
		}

		const oldParent = this.ensureParentOrder(oldParentPath);
		const newParent = this.ensureParentOrder(newParentPath);

		oldParent.customOrder = oldParent.customOrder.filter((name) => name !== oldName);

		if (!newParent.customOrder.includes(newName)) {
			const insertAt =
				this.plugin.settings.newItemPlacement === 'top' ? 0 : newParent.customOrder.length;
			newParent.customOrder.splice(insertAt, 0, newName);
		}

		void this.plugin.saveSettings();

		if (oldParentPath === newParentPath) {
			this.plugin.sortExplorer();
		}
	}

	remove(path: string) {
		const parentPath = normalizeParentPath(getParentPath(path));
		const name = getName(path);
		const parentOrder = this.plugin.settings.folders[parentPath];

		delete this.plugin.settings.folders[path];

		if (parentOrder) {
			parentOrder.customOrder = parentOrder.customOrder.filter((n) => n !== name);
		}

		void this.plugin.saveSettings();
	}

	move(
		fromPath: string,
		toPath: string,
		siblingPath?: string,
		position?: InsertPosition,
	) {
		const folders = this.plugin.settings.folders;
		const fromName = getName(fromPath);
		const toName = getName(toPath);
		const fromParentPath = normalizeParentPath(getParentPath(fromPath));
		const toParentPath = normalizeParentPath(getParentPath(toPath));
		const parentChanged = fromParentPath !== toParentPath;

		if (fromPath !== toPath && folders[fromPath]) {
			folders[toPath] = folders[fromPath];
			delete folders[fromPath];
		}

		const fromParent = this.ensureParentOrder(fromParentPath);
		const toParent = this.ensureParentOrder(toParentPath);
		const fromIndex = fromParent.customOrder.indexOf(fromName);

		let insertIndex = toParent.customOrder.length;
		if (siblingPath) {
			const siblingName = getName(siblingPath);
			const siblingIndex = toParent.customOrder.indexOf(siblingName);
			if (siblingIndex !== -1) {
				insertIndex = position === 'before' ? siblingIndex : siblingIndex + 1;
			}
		} else if (!parentChanged && fromIndex !== -1) {
			insertIndex = fromIndex;
		}

		fromParent.customOrder = fromParent.customOrder.filter((name) => {
			if (name === fromName) {
				if (!parentChanged && fromIndex < insertIndex) {
					insertIndex--;
				}
				return false;
			}
			return true;
		});

		if (!toParent.customOrder.includes(toName)) {
			toParent.customOrder.splice(insertIndex, 0, toName);
		}

		void this.plugin.saveSettings();

		if (!parentChanged) {
			this.plugin.sortExplorer();
		}
	}

	moveRelative(itemPath: string, direction: MoveDirection): boolean {
		const parentPath = normalizeParentPath(getParentPath(itemPath));
		const parentOrder = this.ensureParentOrder(parentPath);
		const name = getName(itemPath);
		const currentIndex = parentOrder.customOrder.indexOf(name);

		if (currentIndex === -1) {
			parentOrder.customOrder.push(name);
		}

		const index = parentOrder.customOrder.indexOf(name);
		if (index === -1) return false;

		let newIndex = index;
		switch (direction) {
			case 'up':
				newIndex = Math.max(0, index - 1);
				break;
			case 'down':
				newIndex = Math.min(parentOrder.customOrder.length - 1, index + 1);
				break;
			case 'top':
				newIndex = 0;
				break;
			case 'bottom':
				newIndex = parentOrder.customOrder.length - 1;
				break;
		}

		if (newIndex === index) return false;

		parentOrder.customOrder.splice(index, 1);
		parentOrder.customOrder.splice(newIndex, 0, name);
		void this.plugin.saveSettings();
		this.plugin.sortExplorer();
		return true;
	}

	resetOrder() {
		this.plugin.settings.folders = {};
		this.syncItems();
		this.plugin.sortExplorer();
	}

	getSortedItems(
		parentPath: string,
		items: FileTreeItem[],
	): FileTreeItem[] {
		if (!items?.length) return items ?? [];
		if (!this.plugin.settings.enabled) return items;

		const parentOrder = this.plugin.settings.folders[normalizeParentPath(parentPath)];
		if (!parentOrder?.customOrder.length) return items;

		return items.slice().sort((aItem, bItem) => {
			const aIndex = parentOrder.customOrder.indexOf(aItem.file.name);
			const bIndex = parentOrder.customOrder.indexOf(bItem.file.name);

			if (aIndex === -1 && bIndex === -1) {
				return collator.compare(aItem.file.name, bItem.file.name);
			}
			if (aIndex === -1) return 1;
			if (bIndex === -1) return -1;
			return aIndex - bIndex;
		});
	}

	ensureParentOrder(parentPath: string): ParentOrder {
		const key = normalizeParentPath(parentPath);
		if (!this.plugin.settings.folders[key]) {
			this.plugin.settings.folders[key] = emptyParentOrder();
		}
		return this.plugin.settings.folders[key];
	}

	private syncFolder(folder: TFolder) {
		const folderPath = normalizeParentPath(folder.path);
		const existing = this.plugin.settings.folders[folderPath];
		const childNames = folder.children.map((child) => child.name);
		const previousOrder = existing?.customOrder ?? [];

		let merged = previousOrder.filter((name) => childNames.includes(name));
		const added = childNames.filter((name) => !previousOrder.includes(name));
		merged =
			this.plugin.settings.newItemPlacement === 'top'
				? [...added, ...merged]
				: [...merged, ...added];

		this.plugin.settings.folders[folderPath] = { customOrder: merged };

		for (const child of folder.children) {
			if (child instanceof TFolder) {
				this.syncFolder(child);
			}
		}
	}

	private cleanUpInvalidPaths() {
		for (const path of Object.keys(this.plugin.settings.folders)) {
			if (path === ROOT_PATH) continue;
			if (!this.plugin.app.vault.getAbstractFileByPath(path)) {
				delete this.plugin.settings.folders[path];
			}
		}
	}
}
