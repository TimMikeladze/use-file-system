import { useCallback, useEffect, useRef, useState } from "react";
import type {
	OpfsChange,
	OpfsEntry,
	OpfsPath,
	UseOpfsOptions,
	UseOpfsResult,
} from "../types";
import { toOpfsPath } from "../types";
import { OpfsBroadcast } from "./broadcast";
import {
	isOpfsSupported,
	createDirectory as opfsCreateDirectory,
	deleteDirectory as opfsDeleteDirectory,
	deleteFile as opfsDeleteFile,
	exists as opfsExists,
	readFile as opfsReadFile,
	readFileBuffer as opfsReadFileBuffer,
	scanDirectory as opfsScanDirectory,
	writeFile as opfsWriteFile,
} from "./opfs-client";

/**
 * React hook for Origin Private File System (OPFS) access
 *
 * OPFS is a sandboxed filesystem available to web apps without user prompts.
 * Unlike the File System Access API, OPFS is:
 * - Always available (no permission prompts)
 * - Origin-scoped (isolated per domain)
 * - Persistent (survives browser restarts)
 * - Fast (optimized for web app storage)
 *
 * Features:
 * - Lazy scanning (metadata only, content on-demand)
 * - Cross-tab sync via BroadcastChannel
 * - Async generator-based scanning for memory efficiency
 */
export function useOpfs(options: UseOpfsOptions = {}): UseOpfsResult {
	const {
		basePath = toOpfsPath("/"),
		scan: scanOnMount = false,
		broadcast: enableBroadcast = true,
		channelName = "use-opfs",
		onChange,
		onError,
	} = options;

	// State
	const [files, setFiles] = useState<Map<OpfsPath, OpfsEntry>>(new Map());
	const [isScanning, setIsScanning] = useState(false);
	const [isBroadcasting, setIsBroadcasting] = useState(false);

	// Refs for stable callbacks
	const onChangeRef = useRef(onChange);
	const onErrorRef = useRef(onError);
	const broadcastRef = useRef<OpfsBroadcast | null>(null);

	// Keep refs in sync
	useEffect(() => {
		onChangeRef.current = onChange;
		onErrorRef.current = onError;
	}, [onChange, onError]);

	// Check support
	const isSupported = isOpfsSupported();

	// Initialize broadcast channel
	useEffect(() => {
		if (!(enableBroadcast && isSupported)) {
			return;
		}

		const broadcast = new OpfsBroadcast(channelName);
		broadcastRef.current = broadcast;
		setIsBroadcasting(broadcast.isConnected);

		// Subscribe to changes from other tabs
		const unsubscribe = broadcast.subscribe((changes) => {
			// Apply changes to our state
			setFiles((prev) => {
				const next = new Map(prev);

				for (const change of changes) {
					switch (change.type) {
						case "added":
						case "modified":
							next.set(change.entry.path, change.entry);
							break;
						case "deleted":
							next.delete(change.path);
							break;
						default: {
							const _exhaustive: never = change;
							throw new Error(`Unknown change type: ${_exhaustive}`);
						}
					}
				}

				return next;
			});

			// Notify listener
			onChangeRef.current?.(changes);
		});

		return () => {
			unsubscribe();
			broadcast.close();
			broadcastRef.current = null;
			setIsBroadcasting(false);
		};
	}, [enableBroadcast, channelName, isSupported]);

	// Broadcast changes helper
	const broadcastChanges = useCallback((changes: OpfsChange[]) => {
		broadcastRef.current?.broadcast(changes);
		onChangeRef.current?.(changes);
	}, []);

	// Scan directory
	const scan = useCallback(async (): Promise<void> => {
		if (!isSupported) {
			return;
		}

		setIsScanning(true);

		try {
			const entries = new Map<OpfsPath, OpfsEntry>();

			for await (const entry of opfsScanDirectory(basePath)) {
				entries.set(entry.path, entry);
			}

			setFiles(entries);
		} catch (error) {
			onErrorRef.current?.(error as Error);
		} finally {
			setIsScanning(false);
		}
	}, [basePath, isSupported]);

	// Scan on mount if configured
	useEffect(() => {
		if (scanOnMount && isSupported) {
			scan();
		}
	}, [scanOnMount, isSupported, scan]);

	// Clear state
	const clear = useCallback((): void => {
		setFiles(new Map());
	}, []);

	// Read file content
	const readFile = useCallback(
		(path: OpfsPath): Promise<string> => opfsReadFile(path),
		[],
	);

	// Read file as buffer
	const readFileBuffer = useCallback(
		(path: OpfsPath): Promise<ArrayBuffer> => opfsReadFileBuffer(path),
		[],
	);

	// Write file
	const writeFile = useCallback(
		async (path: OpfsPath, content: string | ArrayBuffer): Promise<void> => {
			const existed = files.has(path);
			const previousEntry = existed ? files.get(path) : undefined;

			try {
				const entry = await opfsWriteFile(path, content);

				// Update state
				setFiles((prev) => new Map(prev).set(path, entry));

				// Broadcast change
				let change: OpfsChange;
				if (existed && previousEntry) {
					change = {
						type: "modified",
						entry,
						previousLastModified: previousEntry.lastModified,
					};
				} else {
					change = { type: "added", entry };
				}

				broadcastChanges([change]);
			} catch (error) {
				onErrorRef.current?.(error as Error);
				throw error;
			}
		},
		[files, broadcastChanges],
	);

	// Delete file
	const deleteFile = useCallback(
		async (path: OpfsPath): Promise<void> => {
			try {
				await opfsDeleteFile(path);

				// Update state
				setFiles((prev) => {
					const next = new Map(prev);
					next.delete(path);
					return next;
				});

				// Broadcast change
				broadcastChanges([{ type: "deleted", path }]);
			} catch (error) {
				onErrorRef.current?.(error as Error);
				throw error;
			}
		},
		[broadcastChanges],
	);

	// Create directory
	const createDirectory = useCallback(async (path: OpfsPath): Promise<void> => {
		try {
			await opfsCreateDirectory(path);
		} catch (error) {
			onErrorRef.current?.(error as Error);
			throw error;
		}
	}, []);

	// Delete directory
	const deleteDirectory = useCallback(
		async (path: OpfsPath): Promise<void> => {
			try {
				// Find all files under this directory to broadcast deletions
				const deletedPaths: OpfsPath[] = [];
				const prefix = path.endsWith("/") ? path : `${path}/`;

				for (const filePath of files.keys()) {
					if (filePath.startsWith(prefix)) {
						deletedPaths.push(filePath);
					}
				}

				await opfsDeleteDirectory(path);

				// Update state
				setFiles((prev) => {
					const next = new Map(prev);
					for (const p of deletedPaths) {
						next.delete(p);
					}
					return next;
				});

				// Broadcast deletions
				if (deletedPaths.length > 0) {
					broadcastChanges(
						deletedPaths.map((p) => ({ type: "deleted", path: p })),
					);
				}
			} catch (error) {
				onErrorRef.current?.(error as Error);
				throw error;
			}
		},
		[files, broadcastChanges],
	);

	// Check existence
	const exists = useCallback(
		(path: OpfsPath): Promise<boolean> => opfsExists(path),
		[],
	);

	return {
		files,
		isScanning,
		isSupported,
		isBroadcasting,
		scan,
		clear,
		readFile,
		readFileBuffer,
		writeFile,
		deleteFile,
		createDirectory,
		deleteDirectory,
		exists,
	};
}
