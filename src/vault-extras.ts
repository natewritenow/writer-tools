import { Vault } from 'obsidian';

/** Undocumented Vault helpers used at runtime by Obsidian. */
interface VaultExtras {
	getAbstractFileByPathInsensitive(path: string): import('obsidian').TAbstractFile | null;
	getAvailablePath(path: string, extension: string): string;
}

export function getVaultExtras(vault: Vault): VaultExtras {
	return vault as Vault & VaultExtras;
}
