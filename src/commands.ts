import { Notice, TAbstractFile } from 'obsidian';
import type WriterToolsPlugin from './main';
import type { MoveDirection } from './types';

function getTargetFile(plugin: WriterToolsPlugin): TAbstractFile | null {
	const view = plugin.getExplorerView();
	if (!view) return null;

	const selected = view.tree.selectedDoms;
	if (selected.length === 0) return null;
	return selected[selected.length - 1]?.file ?? null;
}

function moveSelected(plugin: WriterToolsPlugin, direction: MoveDirection) {
	if (!plugin.settings.enabled) {
		new Notice('Enable manual sorting in writer tools settings first.');
		return;
	}

	const file = getTargetFile(plugin);
	if (!file) {
		new Notice('Select a file or folder in the file explorer first.');
		return;
	}

	const moved = plugin.orderManager.moveRelative(file.path, direction);
	if (!moved) {
		new Notice('Item is already at that position.');
	}
}

export function registerCommands(plugin: WriterToolsPlugin) {
	plugin.addCommand({
		id: 'move-up',
		name: 'Move up',
		checkCallback: (checking) => {
			if (!plugin.settings.enabled) return false;
			if (checking) return getTargetFile(plugin) !== null;
			moveSelected(plugin, 'up');
			return true;
		},
	});

	plugin.addCommand({
		id: 'move-down',
		name: 'Move down',
		checkCallback: (checking) => {
			if (!plugin.settings.enabled) return false;
			if (checking) return getTargetFile(plugin) !== null;
			moveSelected(plugin, 'down');
			return true;
		},
	});

	plugin.addCommand({
		id: 'move-to-top',
		name: 'Move to top',
		checkCallback: (checking) => {
			if (!plugin.settings.enabled) return false;
			if (checking) return getTargetFile(plugin) !== null;
			moveSelected(plugin, 'top');
			return true;
		},
	});

	plugin.addCommand({
		id: 'move-to-bottom',
		name: 'Move to bottom',
		checkCallback: (checking) => {
			if (!plugin.settings.enabled) return false;
			if (checking) return getTargetFile(plugin) !== null;
			moveSelected(plugin, 'bottom');
			return true;
		},
	});

	plugin.addCommand({
		id: 'toggle-manual-sort',
		name: 'Toggle manual sorting',
		callback: async () => {
			plugin.settings.enabled = !plugin.settings.enabled;
			await plugin.saveSettings();
			plugin.refreshExplorer();
			new Notice(
				plugin.settings.enabled
					? 'Manual sorting enabled'
					: 'Manual sorting disabled',
			);
		},
	});

	plugin.addCommand({
		id: 'reset-order',
		name: 'Reset custom order',
		callback: () => {
			plugin.orderManager.resetOrder();
			new Notice('Custom order reset.');
		},
	});
}
