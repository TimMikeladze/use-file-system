import type { CreateFilter, FilePath, Filter } from "../types";
import { createDistFilter } from "./dist";
import { createGitFilter } from "./git";
import { createMiscFilter } from "./misc";

export { createGitFilter } from "./git";
export { createDistFilter } from "./dist";
export { createMiscFilter } from "./misc";

/** Default set of filters: git + dist + misc */
export const defaultFilters: CreateFilter[] = [
	createGitFilter,
	createDistFilter,
	createMiscFilter,
];

/**
 * Combines multiple filters into a single filter
 * A file/directory is included only if ALL filters include it
 */
export const combineFilters = (filters: Filter[]): Filter => {
	return {
		shouldIncludeFile(path: FilePath): boolean {
			return filters.every((f) => f.shouldIncludeFile(path));
		},

		shouldIncludeDirectory(path: FilePath): boolean {
			return filters.every((f) => f.shouldIncludeDirectory(path));
		},
	};
};

/**
 * Initialize all filter factories and combine them
 */
export const initializeFilters = async (
	factories: CreateFilter[],
	rootHandle: FileSystemDirectoryHandle,
	rootPath: FilePath,
): Promise<Filter> => {
	const filters = await Promise.all(
		factories.map((factory) => factory(rootHandle, rootPath)),
	);
	return combineFilters(filters);
};
