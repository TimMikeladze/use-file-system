import { useCallback, useEffect, useRef, useState } from "react";
import { isAbortError, isNotFoundError, toError } from "./async";
import { commonFilters } from "./filters";
import { isAtOrWithin, isWithin, normalizePath, pathSegments } from "./path";
import {
	DEFAULT_BATCH_SIZE,
	type ScanResult,
	scanDirectories,
	toContentMap,
} from "./scan";
import {
	type DirectoryPickerOptions,
	ensurePermission,
	type FileRecord,
	type FileSystemAccessMode,
	type FilesChangeHandler,
	type FileWriteOptions,
	type Filter,
	type FilterFn,
	getDirectoryPicker,
	isFileSystemAccessSupported,
	type WritableFileData,
} from "./types";
import { DEFAULT_CONCURRENCY } from "./walk";

/** How often watched directories are re-scanned, in milliseconds. */
export const DEFAULT_POLL_INTERVAL = 300;
/** How long state updates are coalesced before re-rendering, in milliseconds. */
export const DEFAULT_DEBOUNCE_INTERVAL = 50;
/** How long a scan must run before `isProcessing` flips to `true`. */
export const DEFAULT_PROCESSING_INDICATOR_DELAY = 100;

export interface UseFileSystemOptions {
	/**
	 * Filters applied while walking the watched directories.
	 * Defaults to {@link commonFilters}.
	 */
	filters?: FilterFn[];
	/** Called with files seen for the first time. */
	onFilesAdded?: FilesChangeHandler;
	/** Called with files whose contents changed. */
	onFilesChanged?: FilesChangeHandler;
	/** Called with files that disappeared, mapped to their last known contents. */
	onFilesDeleted?: FilesChangeHandler;
	/** Called for every recoverable error. Also surfaced as `error`. */
	onError?: (error: Error) => void;
	/**
	 * Delay between scans, in milliseconds. Defaults to `300`.
	 *
	 * Lower it for snappier updates at the cost of more disk I/O — every scan
	 * enumerates the tree and stats each file.
	 */
	pollInterval?: number;
	/**
	 * How long `files` updates are coalesced before re-rendering, in
	 * milliseconds. Defaults to `50`. Set to `0` to update synchronously.
	 *
	 * Only the rendered state is debounced; the `onFiles*` callbacks always fire
	 * as soon as a change is detected.
	 */
	debounceInterval?: number;
	/** Maximum number of files read concurrently. Defaults to `50`. */
	batchSize?: number;
	/** Maximum number of directories enumerated concurrently. Defaults to `8`. */
	concurrency?: number;
	/**
	 * Access level requested when opening the directory picker. Defaults to
	 * `"read"`; use `"readwrite"` to get write permission up front instead of
	 * prompting on the first write.
	 */
	mode?: FileSystemAccessMode;
	/** Start polling as soon as a directory is added. Defaults to `true`. */
	autoStartPolling?: boolean;
	/**
	 * How long a scan must run before `isProcessing` becomes `true`, in
	 * milliseconds. Defaults to `100`, which keeps fast polls from re-rendering
	 * consumers twice per tick. Set to `0` to report every scan.
	 */
	processingIndicatorDelay?: number;
}

interface Snapshot {
	files: Map<string, string>;
	handles: Map<string, FileSystemFileHandle>;
}

interface ResolvedEntry {
	directory: FileSystemDirectoryHandle;
	root: FileSystemDirectoryHandle;
	rootPath: string;
	name: string;
	path: string;
}

const EMPTY_SNAPSHOT: Snapshot = {
	files: new Map(),
	handles: new Map(),
};

const useLatest = <T>(value: T) => {
	const ref = useRef(value);

	useEffect(() => {
		ref.current = value;
	});

	return ref;
};

/**
 * Watches one or more directories chosen by the user through the File System
 * Access API, exposing their contents as a `path -> contents` map that stays in
 * sync with disk.
 */
export const useFileSystem = (options: UseFileSystemOptions = {}) => {
	// Only values the polling effect depends on are read during render; every
	// other option is read from `optionsRef` at the moment it is used, so
	// inline callbacks and filter arrays never go stale.
	const { pollInterval = DEFAULT_POLL_INTERVAL } = options;

	const optionsRef = useLatest(options);

	const directoriesRef = useRef<Map<string, FileSystemDirectoryHandle>>(
		new Map(),
	);
	const recordsRef = useRef<Map<string, FileRecord>>(new Map());
	const generationRef = useRef(0);
	const scanRef = useRef<Promise<void> | null>(null);
	const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const indicatorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const activeScansRef = useRef(0);
	const mountedRef = useRef(true);

	const [snapshot, setSnapshot] = useState<Snapshot>(EMPTY_SNAPSHOT);
	const [directories, setDirectories] = useState<string[]>([]);
	const [isProcessing, setIsProcessing] = useState(false);
	const [isPolling, setIsPolling] = useState(false);
	const [isBrowserSupported, setIsBrowserSupported] = useState(false);
	const [error, setError] = useState<Error | null>(null);

	// Resolved on the client only, so server rendering and hydration agree.
	useEffect(() => {
		setIsBrowserSupported(isFileSystemAccessSupported());
	}, []);

	useEffect(() => {
		mountedRef.current = true;

		return () => {
			mountedRef.current = false;
			generationRef.current += 1;

			if (flushTimerRef.current !== null) {
				clearTimeout(flushTimerRef.current);
				flushTimerRef.current = null;
			}

			if (indicatorTimerRef.current !== null) {
				clearTimeout(indicatorTimerRef.current);
				indicatorTimerRef.current = null;
			}
		};
	}, []);

	const reportError = useCallback(
		(value: unknown) => {
			const normalized = toError(value);

			if (mountedRef.current) {
				// A permanently unreadable directory would otherwise re-render the
				// consumer on every poll; only surface genuinely new failures.
				setError((current) =>
					current?.name === normalized.name &&
					current.message === normalized.message
						? current
						: normalized,
				);
			}

			optionsRef.current.onError?.(normalized);
		},
		[optionsRef],
	);

	const flush = useCallback(() => {
		if (flushTimerRef.current !== null) {
			clearTimeout(flushTimerRef.current);
			flushTimerRef.current = null;
		}

		if (!mountedRef.current) {
			return;
		}

		const records = recordsRef.current;

		if (records.size === 0) {
			setSnapshot((current) =>
				current.files.size === 0 ? current : EMPTY_SNAPSHOT,
			);
			return;
		}

		const files = new Map<string, string>();
		const handles = new Map<string, FileSystemFileHandle>();

		for (const [path, record] of records) {
			files.set(path, record.content);
			handles.set(path, record.handle);
		}

		setSnapshot({ files, handles });
	}, []);

	const scheduleFlush = useCallback(() => {
		const delay =
			optionsRef.current.debounceInterval ?? DEFAULT_DEBOUNCE_INTERVAL;

		if (delay <= 0) {
			flush();
			return;
		}

		if (flushTimerRef.current !== null) {
			clearTimeout(flushTimerRef.current);
		}

		flushTimerRef.current = setTimeout(() => {
			flushTimerRef.current = null;
			flush();
		}, delay);
	}, [flush, optionsRef]);

	const beginProcessing = useCallback(() => {
		activeScansRef.current += 1;

		if (activeScansRef.current > 1 || indicatorTimerRef.current !== null) {
			return;
		}

		const delay =
			optionsRef.current.processingIndicatorDelay ??
			DEFAULT_PROCESSING_INDICATOR_DELAY;

		if (delay <= 0) {
			if (mountedRef.current) {
				setIsProcessing(true);
			}
			return;
		}

		indicatorTimerRef.current = setTimeout(() => {
			indicatorTimerRef.current = null;

			if (activeScansRef.current > 0 && mountedRef.current) {
				setIsProcessing(true);
			}
		}, delay);
	}, [optionsRef]);

	const endProcessing = useCallback(() => {
		activeScansRef.current = Math.max(0, activeScansRef.current - 1);

		if (activeScansRef.current > 0) {
			return;
		}

		if (indicatorTimerRef.current !== null) {
			clearTimeout(indicatorTimerRef.current);
			indicatorTimerRef.current = null;
		}

		if (mountedRef.current) {
			setIsProcessing(false);
		}
	}, []);

	const emit = useCallback(
		(
			result: Pick<ScanResult, "added" | "changed" | "deleted">,
			previousFiles: Map<string, string>,
		) => {
			const handlers = optionsRef.current;

			if (result.added.size > 0) {
				handlers.onFilesAdded?.(result.added, previousFiles);
			}

			if (result.changed.size > 0) {
				handlers.onFilesChanged?.(result.changed, previousFiles);
			}

			if (result.deleted.size > 0) {
				handlers.onFilesDeleted?.(result.deleted, previousFiles);
			}
		},
		[optionsRef],
	);

	const performScan = useCallback(async () => {
		const generation = generationRef.current;
		const current = optionsRef.current;

		if (directoriesRef.current.size === 0) {
			return;
		}

		let filters: Filter[];

		try {
			filters = await Promise.all(
				(current.filters ?? commonFilters).map((createFilterFn) =>
					createFilterFn(),
				),
			);
		} catch (filterError) {
			reportError(filterError);
			return;
		}

		const previous = recordsRef.current;
		const result = await scanDirectories({
			directories: directoriesRef.current,
			filters,
			previous,
			batchSize: current.batchSize ?? DEFAULT_BATCH_SIZE,
			concurrency: current.concurrency ?? DEFAULT_CONCURRENCY,
			onError: reportError,
		});

		// The hook was cleared (or unmounted) while we were scanning; the result
		// describes a tree nobody is watching any more.
		if (generation !== generationRef.current) {
			return;
		}

		recordsRef.current = result.records;

		if (
			result.added.size === 0 &&
			result.changed.size === 0 &&
			result.deleted.size === 0
		) {
			return;
		}

		scheduleFlush();
		emit(result, toContentMap(previous));
	}, [emit, optionsRef, reportError, scheduleFlush]);

	const runScan = useCallback((): Promise<void> => {
		const inFlight = scanRef.current;

		if (inFlight) {
			return inFlight;
		}

		beginProcessing();

		const promise = performScan()
			.catch(reportError)
			.finally(() => {
				scanRef.current = null;
				endProcessing();
			});

		scanRef.current = promise;

		return promise;
	}, [beginProcessing, endProcessing, performScan, reportError]);

	/** Runs a scan now, waiting for any in-flight scan to settle first. */
	const refresh = useCallback(async () => {
		const inFlight = scanRef.current;

		if (inFlight) {
			await inFlight;
		}

		await runScan();
	}, [runScan]);

	useEffect(() => {
		if (!isPolling) {
			return;
		}

		let cancelled = false;
		let timer: ReturnType<typeof setTimeout> | null = null;

		// A self-rescheduling timeout rather than an interval: the next scan is
		// only queued once the previous one has settled, so a slow directory can
		// never pile ticks up on top of each other.
		const schedule = () => {
			timer = setTimeout(
				() => {
					runScan().then(() => {
						if (!cancelled) {
							schedule();
						}
					});
				},
				Math.max(0, pollInterval),
			);
		};

		schedule();

		return () => {
			cancelled = true;

			if (timer !== null) {
				clearTimeout(timer);
			}
		};
	}, [isPolling, pollInterval, runScan]);

	const startPolling = useCallback(() => {
		setIsPolling(true);
	}, []);

	const stopPolling = useCallback(() => {
		setIsPolling(false);
	}, []);

	/**
	 * Watches `handle`, returning the path it is exposed under.
	 *
	 * Use this to restore a handle persisted in IndexedDB across sessions.
	 * Adding a handle that is already watched is a no-op.
	 */
	const addDirectory = useCallback(
		async (handle: FileSystemDirectoryHandle): Promise<string> => {
			for (const [path, existing] of directoriesRef.current) {
				if (existing === handle || (await existing.isSameEntry(handle))) {
					return path;
				}
			}

			let path = handle.name;

			for (let suffix = 2; directoriesRef.current.has(path); suffix += 1) {
				path = `${handle.name} (${suffix})`;
			}

			directoriesRef.current.set(path, handle);
			setDirectories(Array.from(directoriesRef.current.keys()));
			setError(null);

			// `refresh` rather than `runScan`: a poll already in flight started
			// before this directory existed and would not include it.
			await refresh();

			if (optionsRef.current.autoStartPolling !== false) {
				setIsPolling(true);
			}

			return path;
		},
		[optionsRef, refresh],
	);

	/** Opens the directory picker and watches the chosen directory. */
	const onDirectorySelection = useCallback(
		async (pickerOptions?: DirectoryPickerOptions): Promise<string | null> => {
			const picker = getDirectoryPicker();

			if (!picker) {
				reportError(
					new Error(
						"The File System Access API is not available in this browser.",
					),
				);
				return null;
			}

			try {
				const handle = await picker({
					mode: optionsRef.current.mode ?? "read",
					...pickerOptions,
				});

				return await addDirectory(handle);
			} catch (selectionError) {
				// Dismissing the picker is a normal outcome, not a failure.
				if (!isAbortError(selectionError)) {
					reportError(selectionError);
				}

				return null;
			}
		},
		[addDirectory, optionsRef, reportError],
	);

	const forgetPaths = useCallback(
		(matches: (path: string) => boolean) => {
			const records = recordsRef.current;
			const removed = new Map<string, string>();

			for (const [path, record] of records) {
				if (matches(path)) {
					removed.set(path, record.content);
				}
			}

			if (removed.size === 0) {
				return;
			}

			const previousFiles = toContentMap(records);

			for (const path of removed.keys()) {
				records.delete(path);
			}

			flush();
			optionsRef.current.onFilesDeleted?.(removed, previousFiles);
		},
		[flush, optionsRef],
	);

	/** Stops watching a directory previously added, without touching disk. */
	const removeDirectory = useCallback(
		(directoryPath: string) => {
			if (!directoriesRef.current.delete(directoryPath)) {
				return;
			}

			setDirectories(Array.from(directoriesRef.current.keys()));
			forgetPaths((path) => isAtOrWithin(path, directoryPath));

			if (directoriesRef.current.size === 0) {
				setIsPolling(false);
			}
		},
		[forgetPaths],
	);

	/** Stops watching everything and resets the hook to its initial state. */
	const clear = useCallback(() => {
		// Invalidate any scan that is still running so it cannot repopulate state.
		generationRef.current += 1;
		directoriesRef.current = new Map();
		recordsRef.current = new Map();

		if (flushTimerRef.current !== null) {
			clearTimeout(flushTimerRef.current);
			flushTimerRef.current = null;
		}

		setDirectories([]);
		setIsPolling(false);
		setError(null);
		setSnapshot((current) =>
			current.files.size === 0 ? current : EMPTY_SNAPSHOT,
		);
	}, []);

	const resolveEntry = useCallback(
		async (
			rawPath: string,
			{ createDirectories = false } = {},
		): Promise<ResolvedEntry> => {
			const path = normalizePath(rawPath);
			let rootPath: string | null = null;

			for (const candidate of directoriesRef.current.keys()) {
				if (
					isWithin(path, candidate) &&
					(rootPath === null || candidate.length > rootPath.length)
				) {
					rootPath = candidate;
				}
			}

			if (rootPath === null) {
				throw new Error(`No watched directory contains "${path}"`);
			}

			const root = directoriesRef.current.get(
				rootPath,
			) as FileSystemDirectoryHandle;
			const segments = pathSegments(path.slice(rootPath.length + 1));
			const name = segments.pop() as string;

			let directory = root;

			for (const segment of segments) {
				directory = await directory.getDirectoryHandle(segment, {
					create: createDirectories,
				});
			}

			return { directory, root, rootPath, name, path };
		},
		[],
	);

	const requireWritePermission = useCallback(
		async (root: FileSystemDirectoryHandle) => {
			if (!(await ensurePermission(root, "readwrite"))) {
				throw new Error(`Write permission was not granted for "${root.name}"`);
			}
		},
		[],
	);

	/**
	 * Re-reads a handle and folds it into the watched state, emitting the
	 * matching lifecycle callback.
	 */
	const trackFile = useCallback(
		async (path: string, handle: FileSystemFileHandle) => {
			const file = await handle.getFile();
			const content = await file.text();
			const records = recordsRef.current;
			const previous = records.get(path);
			const previousFiles = toContentMap(records);

			records.set(path, {
				handle,
				content,
				lastModified: file.lastModified,
				size: file.size,
			});

			flush();

			const payload = new Map([[path, content]]);

			if (!previous) {
				optionsRef.current.onFilesAdded?.(payload, previousFiles);
			} else if (previous.content !== content) {
				optionsRef.current.onFilesChanged?.(payload, previousFiles);
			}
		},
		[flush, optionsRef],
	);

	/**
	 * Writes `data` to `path`, which must live inside a watched directory.
	 *
	 * Missing parent directories are created when `create` is `true`.
	 */
	const writeFile = useCallback(
		async (
			path: string,
			data: WritableFileData,
			writeOptions: FileWriteOptions = {},
		): Promise<void> => {
			const { create = true, truncate = true } = writeOptions;
			const entry = await resolveEntry(path, { createDirectories: create });

			await requireWritePermission(entry.root);

			let handle: FileSystemFileHandle;

			try {
				handle = await entry.directory.getFileHandle(entry.name, { create });
			} catch (handleError) {
				if (isNotFoundError(handleError)) {
					throw new Error(`File not found: ${entry.path}`);
				}

				throw handleError;
			}

			const writable = await handle.createWritable({
				keepExistingData: !truncate,
			});

			try {
				await writable.write(data as FileSystemWriteChunkType);
				await writable.close();
			} catch (writeError) {
				await writable.abort().catch(() => undefined);
				throw writeError;
			}

			await trackFile(entry.path, handle);
		},
		[requireWritePermission, resolveEntry, trackFile],
	);

	/** Creates (or opens) a file, optionally seeding it with `initialData`. */
	const createFile = useCallback(
		async (
			path: string,
			initialData?: WritableFileData,
		): Promise<FileSystemFileHandle> => {
			const entry = await resolveEntry(path, { createDirectories: true });

			await requireWritePermission(entry.root);

			const handle = await entry.directory.getFileHandle(entry.name, {
				create: true,
			});

			if (initialData === undefined) {
				await trackFile(entry.path, handle);
			} else {
				await writeFile(entry.path, initialData, { truncate: true });
			}

			return handle;
		},
		[requireWritePermission, resolveEntry, trackFile, writeFile],
	);

	/** Deletes a file from disk and drops it from the watched state. */
	const deleteFile = useCallback(
		async (path: string): Promise<void> => {
			const entry = await resolveEntry(path);

			await requireWritePermission(entry.root);
			await entry.directory.removeEntry(entry.name);

			forgetPaths((candidate) => candidate === entry.path);
		},
		[forgetPaths, requireWritePermission, resolveEntry],
	);

	/** Deletes a directory and everything below it. */
	const deleteDirectory = useCallback(
		async (path: string): Promise<void> => {
			const entry = await resolveEntry(path);

			await requireWritePermission(entry.root);
			await entry.directory.removeEntry(entry.name, { recursive: true });

			forgetPaths((candidate) => isAtOrWithin(candidate, entry.path));
		},
		[forgetPaths, requireWritePermission, resolveEntry],
	);

	/** Requests `mode` access for every watched directory. */
	const requestPermission = useCallback(
		async (requestedMode: FileSystemAccessMode = "readwrite") => {
			const results = await Promise.all(
				Array.from(directoriesRef.current.values(), (handle) =>
					ensurePermission(handle, requestedMode),
				),
			);

			return results.every(Boolean);
		},
		[],
	);

	return {
		/** Watched files, keyed by path. */
		files: snapshot.files,
		/** File handles for every watched file, keyed by path. */
		handles: snapshot.handles,
		/** Paths of the watched root directories. */
		directories,
		/** Whether a scan has been running long enough to be worth showing. */
		isProcessing,
		/** Whether the hook is polling for changes. */
		isPolling,
		/** Whether this browser implements the File System Access API. */
		isBrowserSupported,
		/** The most recent recoverable error, if any. */
		error,
		onDirectorySelection,
		addDirectory,
		removeDirectory,
		onClear: clear,
		refresh,
		startPolling,
		stopPolling,
		writeFile,
		createFile,
		deleteFile,
		deleteDirectory,
		requestPermission,
	};
};

export type UseFileSystemResult = ReturnType<typeof useFileSystem>;

/** Alias for {@link useFileSystem}. */
export const useFs = useFileSystem;
