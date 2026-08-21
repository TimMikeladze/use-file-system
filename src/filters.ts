import ignore, { type Ignore } from "ignore";
import { basename, dirname, isWithin, pathSegments } from "./path";
import type { Filter, FilterContext, FilterFn } from "./types";

const alwaysTrue = () => true;

/**
 * Builds a {@link FilterFn} from a partial {@link Filter}.
 *
 * Omitted predicates default to "allow", so a filter only has to describe what
 * it excludes:
 *
 * ```ts
 * const noImages = createFilter({
 *   shouldIncludeFile: ({ name }) => !name.endsWith(".png"),
 * });
 * ```
 */
export const createFilter = (filter: Partial<Filter>): FilterFn => {
	const resolved: Filter = {
		onDirectoryEnter: filter.onDirectoryEnter,
		shouldIncludeFile: filter.shouldIncludeFile ?? alwaysTrue,
		shouldProcessDirectory: filter.shouldProcessDirectory ?? alwaysTrue,
	};

	return () => resolved;
};

/**
 * Excludes directories whose name matches any of `names`, anywhere in the
 * watched tree.
 *
 * Matching is done per path segment relative to the watched root, so selecting
 * a directory that happens to be called `dist` still works — only nested
 * `dist` directories are pruned.
 */
export const createExcludedDirectoryFilter = (
	names: Iterable<string>,
): FilterFn => {
	const excluded = new Set(names);

	const hasExcludedSegment = (relativePath: string) =>
		pathSegments(relativePath).some((segment) => excluded.has(segment));

	return createFilter({
		shouldIncludeFile: ({ relativePath }) =>
			!hasExcludedSegment(dirname(relativePath)),
		shouldProcessDirectory: ({ relativePath }) =>
			!hasExcludedSegment(relativePath),
	});
};

/**
 * Excludes files by exact name or by suffix, anywhere in the watched tree.
 */
export const createExcludedFileFilter = (options: {
	names?: Iterable<string>;
	suffixes?: Iterable<string>;
}): FilterFn => {
	const names = new Set(options.names ?? []);
	const suffixes = Array.from(options.suffixes ?? []);

	return createFilter({
		shouldIncludeFile: ({ name }) =>
			!(names.has(name) || suffixes.some((suffix) => name.endsWith(suffix))),
	});
};

/** Directories excluded by {@link distFilter}. */
export const DEFAULT_EXCLUDED_DIRECTORIES = [
	".cache",
	".next",
	".nuxt",
	".output",
	".parcel-cache",
	".svelte-kit",
	".turbo",
	"build",
	"coverage",
	"dist",
	"node_modules",
	"out",
	"vendor",
];

/** Files excluded by {@link miscFilter}. */
export const DEFAULT_EXCLUDED_FILES = [".DS_Store", "Thumbs.db", "desktop.ini"];

/** File suffixes excluded by {@link miscFilter}. */
export const DEFAULT_EXCLUDED_FILE_SUFFIXES = [".crswap"];

/**
 * Prunes build output and dependency directories such as `node_modules`,
 * `dist` and `.next`.
 */
export const distFilter: FilterFn = createExcludedDirectoryFilter(
	DEFAULT_EXCLUDED_DIRECTORIES,
);

/**
 * Drops operating system and browser scratch files such as `.DS_Store` and the
 * `.crswap` files Chrome creates while a writable stream is open.
 */
export const miscFilter: FilterFn = createExcludedFileFilter({
	names: DEFAULT_EXCLUDED_FILES,
	suffixes: DEFAULT_EXCLUDED_FILE_SUFFIXES,
});

const readTextFile = async (
	directoryHandle: FileSystemDirectoryHandle,
	name: string,
): Promise<string | null> => {
	try {
		const fileHandle = await directoryHandle.getFileHandle(name);
		const file = await fileHandle.getFile();

		return await file.text();
	} catch {
		// A missing `.gitignore` is the common case, and an unreadable one should
		// never abort the scan.
		return null;
	}
};

const GIT_DIRECTORY = ".git";
const GIT_IGNORE_FILE = ".gitignore";

/**
 * Honours `.gitignore` files and always skips `.git` directories.
 *
 * Every `.gitignore` encountered while walking the tree is applied to its own
 * subtree, with deeper files taking precedence — the same layering git uses.
 * Because a directory's `.gitignore` is loaded before any of its entries are
 * tested, results do not depend on the order the browser happens to enumerate
 * entries in.
 */
export const gitFilter: FilterFn = () => {
	// Ordered outermost-first: `onDirectoryEnter` always runs on a parent before
	// any of its descendants.
	const ignores: { directoryPath: string; matcher: Ignore }[] = [];

	const isIgnored = (path: string, isDirectory: boolean): boolean => {
		let ignored = false;

		for (const { directoryPath, matcher } of ignores) {
			if (!isWithin(path, directoryPath)) {
				continue;
			}

			const relativePath = path.slice(directoryPath.length + 1);
			// The `ignore` package needs a trailing slash to match directory-only
			// patterns such as `node_modules/`.
			const result = matcher.test(
				isDirectory ? `${relativePath}/` : relativePath,
			);

			if (result.ignored) {
				ignored = true;
			} else if (result.unignored) {
				ignored = false;
			}
		}

		return ignored;
	};

	return {
		onDirectoryEnter: async (
			context: FilterContext,
			handle: FileSystemDirectoryHandle,
		) => {
			const contents = await readTextFile(handle, GIT_IGNORE_FILE);

			if (contents === null) {
				return;
			}

			ignores.push({
				directoryPath: context.path,
				matcher: ignore({ allowRelativePaths: true }).add(contents),
			});
		},
		shouldIncludeFile: ({ path }) => !isIgnored(path, false),
		shouldProcessDirectory: ({ path }) =>
			basename(path) !== GIT_DIRECTORY && !isIgnored(path, true),
	};
};

/**
 * The default set of filters: build output, OS scratch files and everything
 * `.gitignore` excludes.
 */
export const commonFilters: FilterFn[] = [distFilter, miscFilter, gitFilter];
