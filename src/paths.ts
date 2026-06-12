import { ROOT_PATH } from './types';

export function normalizeParentPath(path: string): string {
	if (!path || path === ROOT_PATH) return ROOT_PATH;
	return path;
}

export function getName(path: string): string {
	const slash = path.lastIndexOf('/');
	return slash === -1 ? path : path.slice(slash + 1);
}

export function getParentPath(path: string): string {
	const slash = path.lastIndexOf('/');
	if (slash <= 0) return ROOT_PATH;
	return path.slice(0, slash);
}
