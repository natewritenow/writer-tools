import { App, Modal, PluginSettingTab, Setting } from 'obsidian';
import type WriterToolsPlugin from './main';

export class ReorderSettingTab extends PluginSettingTab {
	plugin: WriterToolsPlugin;

	constructor(app: App, plugin: WriterToolsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Enable manual sorting')
			.setDesc('When enabled, custom folder and file order is applied in the file explorer.')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enabled)
					.onChange(async (value) => {
						this.plugin.settings.enabled = value;
						await this.plugin.saveSettings();
						this.plugin.refreshExplorer();
					}),
			);

		new Setting(containerEl)
			.setName('New items')
			.setDesc('Where newly created files and folders appear in the custom order.')
			.addDropdown((dropdown) =>
				dropdown
					.addOption('top', 'Top')
					.addOption('bottom', 'Bottom')
					.setValue(this.plugin.settings.newItemPlacement)
					.onChange(async (value) => {
						this.plugin.settings.newItemPlacement = value as 'top' | 'bottom';
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Reset custom order')
			.setDesc('Clear all saved order and rebuild from the current vault structure.')
			.addButton((button) =>
				button.setButtonText('Reset').setWarning().onClick(() => {
					new ConfirmResetModal(this.app, () => {
						this.plugin.orderManager.resetOrder();
					}).open();
				}),
			);

		const syncNote = containerEl.createEl('p', { cls: 'setting-item-description' });
		syncNote.createEl('strong', { text: 'Obsidian Sync: ' });
		syncNote.appendText(
			'Custom order is stored in plugin settings (data.json). To sync order across devices, enable ',
		);
		syncNote.createEl('strong', { text: 'Plugin settings' });
		syncNote.appendText(' in Settings → Sync on each device. Both devices need this plugin installed.');
	}
}

class ConfirmResetModal extends Modal {
	constructor(
		app: App,
		private readonly onConfirm: () => void,
	) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl('h2', { text: 'Reset custom order?' });
		contentEl.createEl('p', {
			text: 'This clears all saved order. The file explorer will rebuild order from the current vault structure.',
		});

		const buttonRow = contentEl.createDiv({ cls: 'modal-button-container' });
		buttonRow.createEl('button', { text: 'Cancel', cls: 'mod-warning' }).onclick = () =>
			this.close();
		buttonRow.createEl('button', { text: 'Reset', cls: 'mod-cta' }).onclick = () => {
			this.onConfirm();
			this.close();
		};
	}

	onClose() {
		this.contentEl.empty();
	}
}
