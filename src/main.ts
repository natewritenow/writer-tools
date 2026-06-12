import { Notice, Plugin } from 'obsidian';
import { registerCommands } from './commands';
import { DndEngine } from './dnd-engine';
import { ExplorerManager } from './explorer-manager';
import { registerFileMenu } from './file-menu';
import { OrderManager } from './order-manager';
import { Patcher } from './patcher';
import { ReorderSettingTab } from './settings-tab';
import { DEFAULT_SETTINGS, type FileExplorerView, type ReorderSettings } from './types';

export default class WriterToolsPlugin extends Plugin {
	settings!: ReorderSettings;

	readonly orderManager = new OrderManager(this);
	readonly explorerManager = new ExplorerManager(this);
	readonly patcher = new Patcher(this);
	readonly dndEngine = new DndEngine(this);

	private initialized = false;

	async onload() {
		await this.loadSettings();

		this.app.workspace.onLayoutReady(() => {
			void this.init();
		});
	}

	onunload() {
		this.explorerManager.disconnectObservers();
		this.dndEngine.detach();
		this.patcher.unpatch();
		this.sortExplorer();
	}

	async onExternalSettingsChange() {
		await this.loadSettings();
		this.refreshExplorer();
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<ReorderSettings>,
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	getExplorerView(): FileExplorerView | null {
		const leaf = this.app.workspace.getLeavesOfType('file-explorer')[0];
		if (!leaf) return null;
		return leaf.view as unknown as FileExplorerView;
	}

	sortExplorer() {
		const view = this.getExplorerView();
		view?.sort();
	}

	refreshExplorer() {
		if (!this.initialized) return;

		if (this.settings.enabled) {
			const patched = this.patcher.patchExplorer();
			if (!patched) {
		new Notice(
			'Writer tools: Unable to patch file explorer. Commands still work.',
		);
			}
		} else {
			this.patcher.unpatch();
		}

		this.sortExplorer();
	}

	private async init() {
		this.addSettingTab(new ReorderSettingTab(this.app, this));
		registerCommands(this);
		registerFileMenu(this);
		this.registerVaultEventHandlers();

		if (this.settings.enabled) {
			const patched = this.patcher.patchExplorer();
			if (!patched) {
		new Notice(
			'Writer tools: Unable to patch file explorer. Commands still work.',
		);
			}
		}

		this.orderManager.syncItems();
		this.sortExplorer();

		this.explorerManager.observeExplorerMount(this.onExplorerMount, {
			checkExisting: true,
		});
		this.explorerManager.observeExplorerMount(this.onExplorerRemount, {
			watch: true,
		});

		this.initialized = true;
	}

	private readonly onExplorerMount = (el: HTMLElement) => {
		if (this.settings.enabled) {
			this.patcher.patchExplorer();
			this.sortExplorer();
			this.dndEngine.attach(el);
		}
	};

	private readonly onExplorerRemount = (el: HTMLElement) => {
		if (this.settings.enabled) {
			this.dndEngine.attach(el);
		}
	};

	private registerVaultEventHandlers() {
		this.registerEvent(
			this.app.vault.on('create', (item) => {
				if (!this.settings.enabled) return;
				this.orderManager.add(item);
			}),
		);

		this.registerEvent(
			this.app.vault.on('rename', (item, oldPath) => {
				if (!this.settings.enabled) return;
				this.orderManager.rename(oldPath, item.path);
			}),
		);

		this.registerEvent(
			this.app.vault.on('delete', (item) => {
				if (!this.settings.enabled) return;
				this.orderManager.remove(item.path);
			}),
		);
	}
}
