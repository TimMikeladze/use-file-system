import { useCallback, useEffect, useRef, useState } from "react";
import { defaultFilters, initializeFilters } from "./filters";
import { collectEntries, detectChanges, scanDirectory } from "./scanner";
import type {
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
	const { pollInterval = DEFAULT_POLL_INTERVAL, onError, onChange } = options;

	// State
	const [files, setFiles] = useState<Map<FilePath, FileEntry>>(new Map());
	const [isScanning, setIsScanning] = useState(false);
	const [isPolling, setIsPolling] = useState(false);

	// Refs for mutable state that shouldn't trigger re-renders
	const rootHandleRef = useRef<FileSystemDirectoryHandle | null>(null);
	const rootPathRef = useRef<FilePath | null>(null);
	const filterRef = useRef<Filter | null>(null);
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const filesRef = useRef<Map<FilePath, FileEntry>>(new Map());
	const isScanningRef = useRef(false);

	// Keep filesRef in sync with state
	useEffect(() => {
		filesRef.current = files;
	}, [files]);

	const isSupported = checkSupport();

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
	 * Open directory picker and initialize watching
	 */
	const selectDirectory = useCallback(async () => {
		if (!(isSupported && window.showDirectoryPicker)) {
			throw new NotSupportedError();
		}

		try {
			const handle = await window.showDirectoryPicker();
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
		} catch (error) {
			// User cancelled picker or other error
			if (error instanceof Error && error.name === "AbortError") {
				return; // User cancelled, not an error
			}
			throw error;
		}
	}, [isSupported, options.filters, scan, startPolling, stopPolling]);

	/**
	 * Clear all state and stop watching
	 */
	const clear = useCallback(() => {
		stopPolling();
		rootHandleRef.current = null;
		rootPathRef.current = null;
		filterRef.current = null;
		filesRef.current = new Map();
		setFiles(new Map());
	}, [stopPolling]);

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
			options: WriteFileOptions = {},
		): Promise<void> => {
			const { truncate = true } = options;

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

				onChange?.([
					{
						type: "modified",
						entry: updatedEntry,
						previousLastModified: entry.lastModified,
					},
				]);
			} catch (error) {
				await writable.abort();
				throw error;
			}
		},
		[onChange],
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

			onChange?.([{ type: "deleted", path }]);
		},
		[onChange],
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

			onChange?.([{ type: "added", entry }]);

			return entry;
		},
		[onChange],
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
		selectDirectory,
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
