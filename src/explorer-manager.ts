import type WriterToolsPlugin from './main';

const EXPLORER_SELECTOR = '[data-type="file-explorer"] > .nav-files-container';

interface ObserveExplorerMountOptions {
	checkExisting?: boolean;
	watch?: boolean;
}

export class ExplorerManager {
	private readonly observers: MutationObserver[] = [];

	constructor(private readonly plugin: WriterToolsPlugin) {}

	waitForExplorerEl(): Promise<HTMLElement> {
		return new Promise((resolve) =>
			this.observeExplorerMount(resolve, { checkExisting: true }),
		);
	}

	observeExplorerMount(
		onMount: (el: HTMLElement) => void,
		{ checkExisting = false, watch = false }: ObserveExplorerMountOptions = {},
	) {
		if (checkExisting) {
			const explorerEl = this.getExplorerEl();
			if (explorerEl) {
				onMount(explorerEl);
				if (!watch) return;
			}
		}

		const observer = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				for (const node of Array.from(mutation.addedNodes)) {
					if (
						node.instanceOf(HTMLElement) &&
						node.matches(EXPLORER_SELECTOR)
					) {
						if (!watch) this.disconnectObserver(observer);
						onMount(node);
						return;
					}
				}
			}
		});

		observer.observe(activeDocument.body, { childList: true, subtree: true });
		this.observers.push(observer);
	}

	disconnectObservers() {
		for (const observer of this.observers) {
			observer.disconnect();
		}
		this.observers.length = 0;
	}

	private getExplorerEl(): HTMLElement | null {
		return activeDocument.querySelector<HTMLElement>(EXPLORER_SELECTOR);
	}

	private disconnectObserver(observer: MutationObserver) {
		observer.disconnect();
		const index = this.observers.indexOf(observer);
		if (index !== -1) this.observers.splice(index, 1);
	}
}
