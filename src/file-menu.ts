import { Menu, TAbstractFile } from 'obsidian';
import type WriterToolsPlugin from './main';
import type { MoveDirection } from './types';

function showReorderMenu(
	plugin: WriterToolsPlugin,
	file: TAbstractFile,
	evt: MouseEvent | KeyboardEvent,
) {
	const move = (direction: MoveDirection) => {
		plugin.orderManager.moveRelative(file.path, direction);
	};

	const submenu = new Menu();
	submenu
		.addItem((item) => item.setTitle('Move up').onClick(() => move('up')))
		.addItem((item) => item.setTitle('Move down').onClick(() => move('down')))
		.addItem((item) => item.setTitle('Move to top').onClick(() => move('top')))
		.addItem((item) =>
			item.setTitle('Move to bottom').onClick(() => move('bottom')),
		);

	if (evt instanceof MouseEvent) {
		submenu.showAtMouseEvent(evt);
	}
}

export function registerFileMenu(plugin: WriterToolsPlugin) {
	plugin.registerEvent(
		plugin.app.workspace.on('file-menu', (menu, file) => {
			if (!plugin.settings.enabled) return;

			menu.addItem((item) =>
				item
					.setTitle('Reorder')
					.setIcon('arrow-up-down')
					.onClick((evt) => showReorderMenu(plugin, file, evt)),
			);
		}),
	);
}
