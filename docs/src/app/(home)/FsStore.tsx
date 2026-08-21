"use client";

import React from "react";
import { commonFilters, useFs } from "use-fs";

/**
 * One watcher for the whole page.
 *
 * The hero panel and the playground are two views of the same directory, so
 * opening a folder at the top of the page fills in everything below it. Two
 * `useFs` calls would mean two independent polling loops over the same tree.
 */

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
	/** Everything the hook holds, plus the page state that hangs off it. */
	reset: () => void;
}

const Context = React.createContext<FsStore | null>(null);

export const FsProvider = ({ children }: { children: React.ReactNode }) => {
	const [events, setEvents] = React.useState<FileEvent[]>([]);
	const [selection, setSelection] = React.useState<Selection>(EMPTY_SELECTION);
	const [isOpening, setIsOpening] = React.useState(false);

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

	const { onDirectorySelection, onClear, files } = fs;

	const open = React.useCallback(async () => {
		setIsOpening(true);
		try {
			await onDirectorySelection();
		} finally {
			setIsOpening(false);
		}
	}, [onDirectorySelection]);

	const reset = React.useCallback(() => {
		onClear();
		setEvents([]);
		setSelection(EMPTY_SELECTION);
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
