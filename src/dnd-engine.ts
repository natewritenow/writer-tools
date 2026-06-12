import { Platform, TAbstractFile, TFile, TFolder } from 'obsidian';
import type WriterToolsPlugin from './main';
import { normalizeParentPath } from './paths';
import { getVaultExtras } from './vault-extras';
import type { FolderTreeItem, InsertPosition } from './types';
import { ROOT_PATH } from './types';

type DragPointerEvent = DragEvent | TouchEvent;

const ROOT_FOLDER_SELECTOR =
	'[data-type="file-explorer"] > .nav-files-container > div';
const TREE_ITEM_SELECTOR = '.tree-item';
const DRAGGABLE_CANDIDATES_SELECTOR =
	'.tree-item:not(.nav-folder:is([data-dragging], :has(> .is-selected)) .tree-item)';
const DRAGGING_SELECTOR = '[data-dragging]';
const DROP_SIBLING_SELECTOR = '[data-drop-sibling]';
const INSERT_POS_SELECTOR = '[data-insert-pos]';
const DROP_FOLDER_SELECTOR = '[data-drop-folder]';

export class DndEngine {
	private readonly dragStartEvent = Platform.isMobile ? 'touchstart' : 'dragstart';
	private readonly dragEvent = Platform.isMobile ? 'touchmove' : 'drag';
	private readonly dropEvent = Platform.isMobile ? 'touchend' : 'drop';

	private readonly scrollZone = 60;
	private readonly baseScrollSpeed = 25;
	private readonly handleWidth = 36;
	private readonly expandDelay = 800;

	private explorerEl?: HTMLElement;
	private explorerRect?: DOMRect;
	private draggingItem?: TAbstractFile;
	private dropSibling: HTMLElement | null = null;
	private dropFolder: HTMLElement | null = null;
	private insertPos: InsertPosition = 'before';
	private pointerY = 0;
	private autoscrollRaf = 0;
	private expandTimeout = 0;
	private expandTarget: HTMLElement | null = null;

	constructor(private readonly plugin: WriterToolsPlugin) {}

	attach(explorerEl: HTMLElement) {
		this.detach();
		this.explorerEl = explorerEl;

		explorerEl.addEventListener(this.dragStartEvent, this.onDragStart);
		explorerEl.addEventListener(this.dragEvent, this.onDrag);
		explorerEl.addEventListener(this.dropEvent, this.onDrop, { capture: true });
		if (!Platform.isMobile) {
			explorerEl.addEventListener('dragend', this.onDragEnd);
		}
	}

	detach() {
		if (!this.explorerEl) return;

		this.onDrag.cancel();
		this.explorerEl.removeEventListener(this.dragStartEvent, this.onDragStart);
		this.explorerEl.removeEventListener(this.dragEvent, this.onDrag);
		this.explorerEl.removeEventListener(this.dropEvent, this.onDrop, {
			capture: true,
		});
		if (!Platform.isMobile) {
			this.explorerEl.removeEventListener('dragend', this.onDragEnd);
		}
		this.explorerEl = undefined;
	}

	private readonly onDragStart = (event: DragPointerEvent) => {
		if (!this.plugin.settings.enabled) return;

		const treeItem = (event.target as HTMLElement).closest<HTMLElement>(
			TREE_ITEM_SELECTOR,
		);
		if (!treeItem) return;

		const view = this.plugin.getExplorerView();
		if (!view) return;

		if (Platform.isMobile) {
			const distRight = treeItem.getBoundingClientRect().right - this.handleWidth;
			const pointerX = this.getPointerX(event);
			if (pointerX < distRight) return;
			event.preventDefault();
		}

		const item = view.files.get(treeItem);
		if (!item) return;

		this.draggingItem = item;
		this.explorerRect = this.explorerEl!.getBoundingClientRect();
		treeItem.dataset.dragging = '';
	};

	private readonly onDrag = this.rafThrottle((event: DragPointerEvent) => {
		if (!this.draggingItem || !this.explorerEl) return;

		if (Platform.isMobile) event.preventDefault();

		const pointerX = this.getPointerX(event);
		this.pointerY = this.getPointerY(event);

		if (this.isPointerOutsideExplorer(pointerX)) {
			this.clearDropIndicators(false);
			return;
		}

		this.startAutoscroll();

		const siblingCandidates = Array.from(
			this.explorerEl.querySelectorAll<HTMLElement>(
				DRAGGABLE_CANDIDATES_SELECTOR,
			),
		);

		let closestDist = Infinity;
		this.dropSibling = null;

		for (const candidate of siblingCandidates) {
			const rect = candidate.getBoundingClientRect();

			let bottomY = rect.bottom;
			if (candidate.matches('.tree-item:nth-last-child(1 of .tree-item)')) {
				let depth = 0;
				let el: HTMLElement | null = candidate.parentElement;
				while (el) {
					if (el.matches('.nav-folder')) depth++;
					el = el.parentElement;
				}
				if (depth) bottomY -= 5 * depth;
			}

			const distToBottom = Math.abs(this.pointerY - bottomY);
			let distToTop = Infinity;
			if (candidate.matches('.tree-item:nth-child(1 of .tree-item)')) {
				distToTop = Math.abs(this.pointerY - rect.top);
			}

			const dist = Math.min(distToBottom, distToTop);
			if (dist < closestDist) {
				closestDist = dist;
				this.insertPos = distToBottom < distToTop ? 'after' : 'before';
				this.dropSibling = candidate;
			}
		}

		const hoveredEl = activeDocument.elementFromPoint(
			pointerX,
			this.pointerY,
		) as HTMLElement | null;
		const folderTitle = hoveredEl?.closest('.nav-folder-title');
		let shouldClearExpand = true;

		if (folderTitle) {
			const titleRect = folderTitle.getBoundingClientRect();
			if (
				this.pointerY > titleRect.top + 10 &&
				this.pointerY < titleRect.bottom - 10
			) {
				const folderEl = folderTitle.parentElement;
				if (folderEl) {
					this.dropSibling = null;
					this.dropFolder = folderEl;

					if (folderEl.matches('.is-collapsed')) {
						if (folderEl !== this.expandTarget) {
							this.scheduleFolderExpand(folderEl);
						}
						shouldClearExpand = false;
					}
				}
			}
		}

		if (shouldClearExpand) this.clearPendingExpand();

		this.clearDropIndicators(false);

		if (this.dropSibling) {
			this.dropFolder =
				this.dropSibling.parentElement?.closest<HTMLElement>(
					`${ROOT_FOLDER_SELECTOR}, .nav-folder`,
				) ?? null;
			this.dropSibling.dataset.dropSibling = '';
			this.dropSibling.dataset.insertPos = this.insertPos;
		}

		if (this.dropFolder) {
			this.dropFolder.dataset.dropFolder = '';
		}

		const view = this.plugin.getExplorerView();
		if (view) view.lastDropTargetEl = null;
	});

	private readonly onDrop = (event: DragPointerEvent) => {
		if (!this.draggingItem) return;
		event.preventDefault();

		const view = this.plugin.getExplorerView();
		if (!view) return;

		let siblingPath: string | undefined;
		let dropFolderPath: string | undefined;

		if (this.dropSibling) {
			const siblingItem = view.files.get(this.dropSibling);
			if (!siblingItem) return;
			siblingPath = siblingItem.path;
			dropFolderPath = normalizeParentPath(siblingItem.parent?.path ?? ROOT_PATH);
		} else if (this.dropFolder) {
			const folderItem = view.files.get(this.dropFolder);
			dropFolderPath = normalizeParentPath(folderItem?.path ?? ROOT_PATH);
		} else {
			return;
		}

		const draggingItem = this.draggingItem;
		const selectedItems = this.getSelectedItems(view);
		const isDraggingSelected = selectedItems.some(
			(item) => item.file === draggingItem,
		);

		if (isDraggingSelected) {
			let insertPos = this.insertPos;
			for (const item of selectedItems) {
				const newPath = this.getNewPath(item.file, dropFolderPath);
				this.moveItem(
					item.file,
					newPath,
					dropFolderPath,
					siblingPath,
					insertPos,
				);
				siblingPath = newPath;
				insertPos = 'after';
			}
		} else {
			const newPath = this.getNewPath(draggingItem, dropFolderPath);
			this.moveItem(
				draggingItem,
				newPath,
				dropFolderPath,
				siblingPath,
				this.insertPos,
			);
		}

		if (Platform.isMobile) this.onDragEnd();
		view.lastDropTargetEl = null;
	};

	private moveItem(
		draggingItem: TAbstractFile,
		newPath: string,
		dropFolderPath: string,
		siblingPath: string | undefined,
		insertPosition: InsertPosition,
	) {
		this.plugin.orderManager.move(
			draggingItem.path,
			newPath,
			siblingPath,
			insertPosition,
		);

		if (draggingItem.path !== newPath) {
			void this.plugin.app.fileManager.renameFile(draggingItem, newPath);
		}
	}

	private getNewPath(item: TAbstractFile, newParentPath: string): string {
		const parent = normalizeParentPath(newParentPath);
		let newPath =
			parent === ROOT_PATH ? item.name : `${parent}/${item.name}`;
		const isPathChanged = item.path !== newPath;
		const vault = getVaultExtras(this.plugin.app.vault);
		const duplicate = vault.getAbstractFileByPathInsensitive(newPath);

		if (isPathChanged && duplicate) {
			if (item instanceof TFile) {
				const basePath = newPath.slice(0, -(item.extension.length + 1));
				newPath = vault.getAvailablePath(basePath, item.extension);
			} else if (item instanceof TFolder) {
				newPath = vault.getAvailablePath(newPath, '');
			}
		}

		return newPath;
	}

	private getSelectedItems(view: NonNullable<ReturnType<WriterToolsPlugin['getExplorerView']>>) {
		const items = [...view.tree.selectedDoms];
		const nonNested = items.filter(
			(selectedItem) =>
				!items.some(
					(selectedFolder) =>
						selectedFolder.file instanceof TFolder &&
						selectedFolder.file.path !== selectedItem.file.path &&
						selectedItem.file.path.startsWith(
							selectedFolder.file.path + '/',
						),
				),
		);

		return nonNested.sort((a, b) => {
			const position = a.el.compareDocumentPosition(b.el);
			if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
			if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
			return 0;
		});
	}

	private readonly onDragEnd = () => {
		this.onDrag.cancel();
		window.cancelAnimationFrame(this.autoscrollRaf);
		this.autoscrollRaf = 0;
		this.clearPendingExpand();
		this.clearDropIndicators();
	};

	private clearDropIndicators(resetState = true) {
		activeDocument
			.querySelectorAll<HTMLElement>(DROP_SIBLING_SELECTOR)
			.forEach((el) => delete el.dataset.dropSibling);
		activeDocument
			.querySelectorAll<HTMLElement>(INSERT_POS_SELECTOR)
			.forEach((el) => delete el.dataset.insertPos);
		activeDocument
			.querySelectorAll<HTMLElement>(DROP_FOLDER_SELECTOR)
			.forEach((el) => delete el.dataset.dropFolder);

		if (resetState) {
			activeDocument
				.querySelectorAll<HTMLElement>(DRAGGING_SELECTOR)
				.forEach((el) => delete el.dataset.dragging);
			this.draggingItem = undefined;
			this.dropSibling = null;
			this.insertPos = 'before';
			this.dropFolder = null;
		}
	}

	private readonly handleAutoscroll = () => {
		if (!this.explorerEl || !this.explorerRect) return;

		const topDist = this.pointerY - this.explorerRect.top;
		const bottomDist = this.explorerRect.bottom - this.pointerY;

		let speed = 0;
		if (topDist < this.scrollZone) {
			speed =
				-Math.max(0.1, 1 - topDist / this.scrollZone) * this.baseScrollSpeed;
		} else if (bottomDist < this.scrollZone) {
			speed =
				Math.max(0.1, 1 - bottomDist / this.scrollZone) * this.baseScrollSpeed;
		}

		this.explorerEl.scrollTop += speed;
		this.autoscrollRaf = window.requestAnimationFrame(this.handleAutoscroll);
	};

	private startAutoscroll() {
		if (!this.autoscrollRaf) {
			this.autoscrollRaf = window.requestAnimationFrame(this.handleAutoscroll);
		}
	}

	private clearPendingExpand() {
		window.clearTimeout(this.expandTimeout);
		this.expandTarget = null;
	}

	private scheduleFolderExpand(folderEl: HTMLElement) {
		this.clearPendingExpand();
		this.expandTarget = folderEl;
		this.expandTimeout = window.setTimeout(() => {
			const view = this.plugin.getExplorerView();
			if (!view) return;
			const folderPath = view.files.get(folderEl)?.path;
			if (!folderPath) return;
			const folderItem = view.fileItems[folderPath] as FolderTreeItem | undefined;
			void folderItem?.setCollapsed(false, true);
		}, this.expandDelay);
	}

	private isPointerOutsideExplorer(pointerX: number) {
		if (!this.explorerRect) return true;
		return (
			pointerX < this.explorerRect.left ||
			pointerX > this.explorerRect.right ||
			this.pointerY < this.explorerRect.top ||
			this.pointerY > this.explorerRect.bottom
		);
	}

	private getPointerX(event: DragPointerEvent) {
		if (event instanceof TouchEvent) {
			return event.touches[0]?.clientX ?? 0;
		}
		return event.clientX;
	}

	private getPointerY(event: DragPointerEvent) {
		if (event instanceof TouchEvent) {
			return event.touches[0]?.clientY ?? 0;
		}
		return event.clientY;
	}

	private rafThrottle<T extends (...args: never[]) => void>(fn: T) {
		let raf = 0;
		let latestArgs: Parameters<T> | undefined;

		const throttled = (...args: Parameters<T>) => {
			latestArgs = args;
			if (raf) return;
			raf = window.requestAnimationFrame(() => {
				raf = 0;
				if (latestArgs) fn(...latestArgs);
			});
		};

		throttled.cancel = () => {
			window.cancelAnimationFrame(raf);
			raf = 0;
		};

		return throttled;
	}
}
