"use client";

import React from "react";
import { commonFilters, getOpfsRoot, useFs } from "use-fs";

/**
 * One watcher for the whole page.
 *
 * The hero panel and the playground are two views of the same directory, so
 * opening a folder at the top of the page fills in everything below it. Two
 * `useFs` calls would mean two independent polling loops over the same tree.
 *
 * Either store can fill it: a folder picked off disk, or the origin private
 * file system. The OPFS mount is what makes the page demonstrable in Safari
 * and Firefox, which have no directory picker at all.
 */

/** Subdirectory of the OPFS root this page mounts. Never the bare root. */
const OPFS_DIRECTORY = "use-fs-demo";

/**
 * Written on the first OPFS mount, so the demo has something to show. Nothing
 * is seeded again once the directory exists - your own edits survive a reload.
 */
const SEED: Record<string, string> = {
	"README.md": `# Browser storage

You are looking at the origin private file system. These files live in your
browser, scoped to this origin, and they survive a reload.

Edit one in the viewer and save it. The watcher picks the write up on its next
scan, exactly as it would for a folder on your disk.
`,
	"notes/todo.md": `- [x] Mount the origin private file system
- [ ] Edit this line and press Save to disk
- [ ] Reload the page - the change is still here
`,
	"notes/scratch.txt": "Anything you write here stays in this browser.\n",
};

export interface FileEvent {
	id: string;
	kind: "added" | "deleted";
	path: string;
	timestamp: number;
}

export interface Selection {
	path: string;
	content: string | null;
	previousContent: string | null;
}

const EMPTY_SELECTION: Selection = {
	path: "",
	content: null,
	previousContent: null,
};

// A batch of entries shares one `Date.now()`, and the same path can be added
// and removed repeatedly, so nothing in the entry itself identifies a row.
let eventId = 0;
const nextEventId = () => {
	eventId += 1;
	return `event-${eventId}`;
};

const MAX_EVENTS = 50;

type Fs = ReturnType<typeof useFs>;

interface FsStore extends Fs {
	events: FileEvent[];
	clearEvents: () => void;
	selection: Selection;
	selectFile: (path: string) => void;
	applyWrite: (content: string) => void;
	/** Opens the picker and tracks the round trip, for a pending label. */
	open: () => Promise<void>;
	isOpening: boolean;
	/** Mounts the origin private file system, seeding it on first use. */
	openOpfs: () => Promise<void>;
	isOpeningOpfs: boolean;
	/** Whether the root the page is showing came from OPFS, not the picker. */
	isOpfs: boolean;
	/** Why the last mount attempt failed, if it did. */
	mountError: Error | null;
	/** Everything the hook holds, plus the page state that hangs off it. */
	reset: () => void;
}

const Context = React.createContext<FsStore | null>(null);

export const FsProvider = ({ children }: { children: React.ReactNode }) => {
	const [events, setEvents] = React.useState<FileEvent[]>([]);
	const [selection, setSelection] = React.useState<Selection>(EMPTY_SELECTION);
	const [isOpening, setIsOpening] = React.useState(false);
	const [isOpeningOpfs, setIsOpeningOpfs] = React.useState(false);
	const [opfsPath, setOpfsPath] = React.useState<string | null>(null);
	const [mountError, setMountError] = React.useState<Error | null>(null);

	const fs = useFs({
		filters: commonFilters,
		onFilesAdded: (added) => {
			const entries = Array.from(added.keys()).map((path) => ({
				id: nextEventId(),
				kind: "added" as const,
				path,
				timestamp: Date.now(),
			}));
			setEvents((prev) => [...entries, ...prev].slice(0, MAX_EVENTS));
		},
		onFilesChanged: (changed, previous) => {
			// Follow the change: whatever moved on disk is what you want to see.
			const [first] = Array.from(changed);
			if (first) {
				const [path, content] = first;
				setSelection({
					path,
					content,
					previousContent: previous.get(path) ?? null,
				});
			}
		},
		onFilesDeleted: (deleted) => {
			setSelection((prev) => (deleted.has(prev.path) ? EMPTY_SELECTION : prev));
			const entries = Array.from(deleted.keys()).map((path) => ({
				id: nextEventId(),
				kind: "deleted" as const,
				path,
				timestamp: Date.now(),
			}));
			setEvents((prev) => [...entries, ...prev].slice(0, MAX_EVENTS));
		},
	});

	const { onDirectorySelection, addOpfsDirectory, writeFile, onClear, files } =
		fs;

	const open = React.useCallback(async () => {
		setIsOpening(true);
		setMountError(null);
		try {
			await onDirectorySelection();
		} finally {
			setIsOpening(false);
		}
	}, [onDirectorySelection]);

	const openOpfs = React.useCallback(async () => {
		setIsOpeningOpfs(true);
		setMountError(null);
		try {
			// Read the directory before mounting it: once the hook has scanned, a
			// seeded file and a file you wrote last visit look identical.
			const handle = await getOpfsRoot({ name: OPFS_DIRECTORY });
			let isEmpty = true;
			for await (const _entry of handle.values()) {
				isEmpty = false;
				break;
			}

			const path = await addOpfsDirectory({ name: OPFS_DIRECTORY });
			setOpfsPath(path);

			if (isEmpty) {
				for (const [name, contents] of Object.entries(SEED)) {
					await writeFile(`${path}/${name}`, contents);
				}
			}
		} catch (error: unknown) {
			// A quota failure or a browser that reports OPFS and then refuses it
			// would otherwise surface as an unhandled rejection.
			setMountError(
				error instanceof Error
					? error
					: new Error("Browser storage could not be mounted."),
			);
		} finally {
			setIsOpeningOpfs(false);
		}
	}, [addOpfsDirectory, writeFile]);

	const reset = React.useCallback(() => {
		onClear();
		setEvents([]);
		setSelection(EMPTY_SELECTION);
		setOpfsPath(null);
		setMountError(null);
	}, [onClear]);

	const selectFile = React.useCallback(
		(path: string) => {
			setSelection({
				path,
				content: files.get(path) ?? null,
				previousContent: null,
			});
		},
		[files],
	);

	const applyWrite = React.useCallback((content: string) => {
		setSelection((prev) => ({
			...prev,
			previousContent: prev.content,
			content,
		}));
	}, []);

	const value: FsStore = {
		...fs,
		events,
		clearEvents: () => setEvents([]),
		selection,
		selectFile,
		applyWrite,
		open,
		isOpening,
		openOpfs,
		isOpeningOpfs,
		// The panels label `directories[0]`, so that is the root to describe.
		isOpfs: opfsPath !== null && fs.directories[0] === opfsPath,
		mountError,
		reset,
	};

	return <Context.Provider value={value}>{children}</Context.Provider>;
};

export const useFsStore = () => {
	const store = React.useContext(Context);
	if (!store) {
		throw new Error("useFsStore must be used inside <FsProvider>");
	}
	return store;
};
