import { useCallback, useEffect, useRef, useState } from "react";
import { FsBroadcast } from "./broadcast";
import { defaultFilters, initializeFilters } from "./filters";
import {
	removeHandle,
	retrieveHandle,
	storeHandle,
	verifyPermission,
} from "./handle-storage";
import { collectEntries, detectChanges, scanDirectory } from "./scanner";
import type {
	FileChange,
	FileEntry,
	FilePath,
	Filter,
	UseFsOptions,
	UseFsResult,
	WriteFileOptions,
} from "./types";
import {
	DirectoryNotFoundError,
	FileNotFoundError,
	NotSupportedError,
	toFilePath,
} from "./types";

const DEFAULT_POLL_INTERVAL = 100;

/**
 * Check if File System Access API is supported
 */
const checkSupport = (): boolean => {
	return (
		typeof window !== "undefined" &&
		typeof window.showDirectoryPicker === "function"
	);
};

/**
 * React hook for file system access with automatic change detection
 */
export function useFileSystem(options: UseFsOptions = {}): UseFsResult {
	const {
		pollInterval = DEFAULT_POLL_INTERVAL,
		onError,
		onChange,
		broadcast: enableBroadcast = false,
		channelName = "use-fs",
		storageKey = "default",
	} = options;

	// State
	const [files, setFiles] = useState<Map<FilePath, FileEntry>>(new Map());
	const [isScanning, setIsScanning] = useState(false);
	const [isPolling, setIsPolling] = useState(false);
	const [isBroadcasting, setIsBroadcasting] = useState(false);

	// Refs for mutable state that shouldn't trigger re-renders
	const rootHandleRef = useRef<FileSystemDirectoryHandle | null>(null);
	const rootPathRef = useRef<FilePath | null>(null);
	const filterRef = useRef<Filter | null>(null);
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const filesRef = useRef<Map<FilePath, FileEntry>>(new Map());
	const isScanningRef = useRef(false);
	const broadcastRef = useRef<FsBroadcast | null>(null);

	// Keep filesRef in sync with state
	useEffect(() => {
		filesRef.current = files;
	}, [files]);

	const isSupported = checkSupport();

	// Initialize broadcast channel if enabled
	useEffect(() => {
		if (enableBroadcast && !broadcastRef.current) {
			broadcastRef.current = new FsBroadcast(channelName);
			setIsBroadcasting(broadcastRef.current.isConnected);

			// Subscribe to messages from other tabs
			const unsubscribe = broadcastRef.current.subscribe((message) => {
				if (message.type === "changes" && message.changes) {
					// Optimistic update: apply changes from other tabs directly
					applyRemoteChanges(message.changes);
				} else if (message.type === "handle-available") {
					// Another tab stored a handle, we could auto-connect
					// For now, just let the app call connectShared() if desired
				}
			});

			return () => {
				unsubscribe();
				broadcastRef.current?.close();
				broadcastRef.current = null;
				setIsBroadcasting(false);
			};
		}
	}, [enableBroadcast, channelName]);

	/**
	 * Apply changes received from another tab (optimistic update)
	 */
	const applyRemoteChanges = useCallback(
		(changes: FileChange[]) => {
			const newFiles = new Map(filesRef.current);
			let hasChanges = false;

			for (const change of changes) {
				if (change.type === "added" || change.type === "modified") {
					// We don't have the file handle from the remote tab,
					// but we can update the metadata. The handle will be
					// populated on next scan or when reading the file.
					const existing = newFiles.get(change.entry.path);
					if (existing) {
						// Update metadata but keep our local handle
						newFiles.set(change.entry.path, {
							...existing,
							lastModified: change.entry.lastModified,
							size: change.entry.size,
						});
					}
					// If we don't have the file, we'll pick it up on next scan
					hasChanges = true;
				} else if (change.type === "deleted") {
					if (newFiles.has(change.path)) {
						newFiles.delete(change.path);
						hasChanges = true;
					}
				}
			}

			if (hasChanges) {
				filesRef.current = newFiles;
				setFiles(newFiles);
				onChange?.(changes);
			}
		},
		[onChange],
	);

	/**
	 * Broadcast changes to other tabs
	 */
	const broadcastChanges = useCallback((changes: FileChange[]) => {
		broadcastRef.current?.broadcastChanges(changes);
	}, []);

	/**
	 * Perform a single scan cycle
	 */
	const scan = useCallback(async () => {
		if (!(rootHandleRef.current && rootPathRef.current && filterRef.current)) {
			return;
		}

		// Prevent concurrent scans
		if (isScanningRef.current) {
			return;
		}

		isScanningRef.current = true;
		setIsScanning(true);

		try {
			const scanner = scanDirectory(
				rootHandleRef.current,
				rootPathRef.current,
				filterRef.current,
			);

			const currentEntries = await collectEntries(scanner);
			const changes = detectChanges(filesRef.current, currentEntries);

			if (changes.length > 0) {
				// Update state with new entries
				setFiles(new Map(currentEntries));
				filesRef.current = currentEntries;

				// Notify via callback
				onChange?.(changes);

				// Broadcast to other tabs (don't broadcast scan results,
				// only explicit mutations, to avoid duplicate notifications)
			}
		} catch (error) {
			onError?.(error instanceof Error ? error : new Error(String(error)));
		} finally {
			isScanningRef.current = false;
			setIsScanning(false);
		}
	}, [onChange, onError]);

	/**
	 * Start the polling interval
	 */
	const startPolling = useCallback(() => {
		if (intervalRef.current) {
			return; // Already polling
		}

		if (!rootHandleRef.current) {
			return; // No directory selected
		}

		intervalRef.current = setInterval(() => {
			scan();
		}, pollInterval);

		setIsPolling(true);
	}, [pollInterval, scan]);

	/**
	 * Stop the polling interval
	 */
	const stopPolling = useCallback(() => {
		if (intervalRef.current) {
			clearInterval(intervalRef.current);
			intervalRef.current = null;
		}
		setIsPolling(false);
	}, []);

	/**
	 * Initialize the hook with a directory handle
	 */
	const initializeWithHandle = useCallback(
		async (handle: FileSystemDirectoryHandle) => {
			const path = toFilePath(handle.name);

			// Stop any existing polling
			stopPolling();

			// Store refs
			rootHandleRef.current = handle;
			rootPathRef.current = path;

			// Initialize filters (static - done once)
			const filterFactories = options.filters ?? defaultFilters;
			filterRef.current = await initializeFilters(
				filterFactories,
				handle,
				path,
			);

			// Do initial scan
			await scan();

			// Start polling
			startPolling();
		},
		[options.filters, scan, startPolling, stopPolling],
	);

	/**
	 * Open directory picker and initialize watching
	 */
	const selectDirectory = useCallback(async () => {
		if (!(isSupported && window.showDirectoryPicker)) {
			throw new NotSupportedError();
		}

		try {
			const handle = await window.showDirectoryPicker();

			await initializeWithHandle(handle);

			// Store handle in IndexedDB for cross-tab access
			if (enableBroadcast) {
				await storeHandle(handle, storageKey);
				broadcastRef.current?.broadcastHandleAvailable();
			}
		} catch (error) {
			// User cancelled picker or other error
			if (error instanceof Error && error.name === "AbortError") {
				return; // User cancelled, not an error
			}
			throw error;
		}
	}, [isSupported, initializeWithHandle, enableBroadcast, storageKey]);

	/**
	 * Try to connect to a shared directory handle from IndexedDB
	 * Returns true if successfully connected, false otherwise
	 */
	const connectShared = useCallback(async (): Promise<boolean> => {
		if (!enableBroadcast) {
			return false;
		}

		try {
			const handle = await retrieveHandle(storageKey);
			if (!handle) {
				return false;
			}

			// Verify we have permission (may prompt user)
			const hasPermission = await verifyPermission(handle);
			if (!hasPermission) {
				return false;
			}

			await initializeWithHandle(handle);
			return true;
		} catch (error) {
			onError?.(error instanceof Error ? error : new Error(String(error)));
			return false;
		}
	}, [enableBroadcast, storageKey, initializeWithHandle, onError]);

	/**
	 * Clear all state and stop watching
	 */
	const clear = useCallback(async () => {
		stopPolling();
		rootHandleRef.current = null;
		rootPathRef.current = null;
		filterRef.current = null;
		filesRef.current = new Map();
		setFiles(new Map());

		// Remove stored handle if broadcast is enabled
		if (enableBroadcast) {
			await removeHandle(storageKey);
		}
	}, [stopPolling, enableBroadcast, storageKey]);

	/**
	 * Read file content on-demand (lazy loading)
	 */
	const readFile = useCallback(async (path: FilePath): Promise<string> => {
		const entry = filesRef.current.get(path);
		if (!entry) {
			throw new FileNotFoundError(path);
		}

		const file = await entry.handle.getFile();
		return file.text();
	}, []);

	/**
	 * Write content to a file
	 */
	const writeFile = useCallback(
		async (
			path: FilePath,
			content: string,
			writeOptions: WriteFileOptions = {},
		): Promise<void> => {
			const { truncate = true } = writeOptions;

			const entry = filesRef.current.get(path);
			if (!entry) {
				throw new FileNotFoundError(path);
			}

			const writable = await entry.handle.createWritable({
				keepExistingData: !truncate,
			});

			try {
				await writable.write(content);
				await writable.close();

				// Update the entry with new metadata
				const file = await entry.handle.getFile();
				const updatedEntry: FileEntry = {
					...entry,
					lastModified: file.lastModified,
					size: file.size,
				};

				filesRef.current.set(path, updatedEntry);
				setFiles(new Map(filesRef.current));

				const changes: FileChange[] = [
					{
						type: "modified",
						entry: updatedEntry,
						previousLastModified: entry.lastModified,
					},
				];

				onChange?.(changes);
				broadcastChanges(changes);
			} catch (error) {
				await writable.abort();
				throw error;
			}
		},
		[onChange, broadcastChanges],
	);

	/**
	 * Delete a file
	 */
	const deleteFile = useCallback(
		async (path: FilePath): Promise<void> => {
			const entry = filesRef.current.get(path);
			if (!entry) {
				throw new FileNotFoundError(path);
			}

			// Find the parent directory
			const parentPath = path.substring(0, path.lastIndexOf("/"));
			const fileName = path.substring(path.lastIndexOf("/") + 1);

			// We need to find the parent directory handle
			// Walk from root to parent
			if (!(rootHandleRef.current && rootPathRef.current)) {
				throw new DirectoryNotFoundError(parentPath);
			}

			let currentHandle: FileSystemDirectoryHandle = rootHandleRef.current;
			const relativePath = parentPath.substring(rootPathRef.current.length);
			const segments = relativePath.split("/").filter(Boolean);

			for (const segment of segments) {
				currentHandle = await currentHandle.getDirectoryHandle(segment);
			}

			await currentHandle.removeEntry(fileName);

			filesRef.current.delete(path);
			setFiles(new Map(filesRef.current));

			const changes: FileChange[] = [{ type: "deleted", path }];
			onChange?.(changes);
			broadcastChanges(changes);
		},
		[onChange, broadcastChanges],
	);

	/**
	 * Create a new file
	 */
	const createFile = useCallback(
		async (path: FilePath, content?: string): Promise<FileEntry> => {
			if (!(rootHandleRef.current && rootPathRef.current)) {
				throw new DirectoryNotFoundError("No directory selected");
			}

			// Navigate to parent directory
			const parentPath = path.substring(0, path.lastIndexOf("/"));
			const fileName = path.substring(path.lastIndexOf("/") + 1);

			let currentHandle: FileSystemDirectoryHandle = rootHandleRef.current;
			const relativePath = parentPath.substring(rootPathRef.current.length);
			const segments = relativePath.split("/").filter(Boolean);

			for (const segment of segments) {
				currentHandle = await currentHandle.getDirectoryHandle(segment, {
					create: true,
				});
			}

			const fileHandle = await currentHandle.getFileHandle(fileName, {
				create: true,
			});

			// Write initial content if provided
			if (content !== undefined) {
				const writable = await fileHandle.createWritable();
				await writable.write(content);
				await writable.close();
			}

			const file = await fileHandle.getFile();
			const entry: FileEntry = {
				path,
				handle: fileHandle,
				lastModified: file.lastModified,
				size: file.size,
			};

			filesRef.current.set(path, entry);
			setFiles(new Map(filesRef.current));

			const changes: FileChange[] = [{ type: "added", entry }];
			onChange?.(changes);
			broadcastChanges(changes);

			return entry;
		},
		[onChange, broadcastChanges],
	);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
			}
		};
	}, []);

	return {
		files,
		isScanning,
		isPolling,
		isSupported,
		isBroadcasting,
		selectDirectory,
		connectShared,
		clear,
		startPolling,
		stopPolling,
		readFile,
		writeFile,
		deleteFile,
		createFile,
	};
}

/** Alias for useFileSystem */
export const useFs = useFileSystem;
