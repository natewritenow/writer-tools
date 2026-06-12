# Writer Tools

Manually reorder folders and files in Obsidian's native file explorer. Works on desktop (macOS) and mobile (iOS), and syncs custom order across devices via Obsidian Sync.

## Features

- **Drag and drop** — reorder items in the file explorer (touch drag handle on mobile)
- **Context menu** — right-click any file or folder → Reorder → Move up/down/top/bottom
- **Command palette** — same reorder actions without drag-and-drop
- **Cross-device sync** — order stored in plugin settings, synced by Obsidian Sync

## Usage

1. Install and enable the plugin.
2. Manual sorting is enabled by default.
3. Drag items in the file explorer to reorder them, or use the context menu / command palette.
4. On iOS, drag from the right edge of a file/folder row (the touch handle).

### Commands

| Command | Description |
|---------|-------------|
| Writer Tools: Move up | Move selected item up one position |
| Writer Tools: Move down | Move selected item down one position |
| Writer Tools: Move to top | Move selected item to the top of its folder |
| Writer Tools: Move to bottom | Move selected item to the bottom of its folder |
| Writer Tools: Toggle manual sorting | Enable or disable custom ordering |
| Writer Tools: Reset custom order | Clear saved order and rebuild from vault |

## Obsidian Sync

Custom order is stored in `.obsidian/plugins/writer-tools/data.json`, not in vault files.

To sync order across devices:

1. Install this plugin on each device.
2. Enable **Plugin settings** in **Settings → Sync** on each device.
3. Keep manual sorting enabled on each device.

Order changes sync as plugin settings. Last write wins if both devices reorder at the same time.

## Development

```bash
npm install
npm run dev
```

Copy or symlink this folder to `your-vault/.obsidian/plugins/writer-tools/`, then enable the plugin in Obsidian settings.

```bash
npm run build
```

### Mobile testing

On desktop, open Developer Tools → Console and run:

```js
app.emulateMobile(true)
```

On a real iOS device, use Safari Web Inspector (iOS 16.4+).

## How it works

Obsidian does not expose a public API for custom file explorer ordering. This plugin stores order in `data.json` and applies it by patching the internal `FileExplorerView.getSortedFolderItems()` method. This approach is used by other community plugins (e.g. Manual Sorting / Flexplorer) and may require updates when Obsidian changes internals.

## License

MIT
