"use client";

import { Highlight, themes } from "prism-react-renderer";
import React, { type JSX } from "react";
import { type FileChange, type FilePath, defaultFilters, retrieveHandle, useFs } from "use-fs";

type FileState = {
	path: string;
	content: string | null;
	previousContent: string | null;
};

const FsaDemo = () => {
	const [selectedFile, setSelectedFile] = React.useState<FileState>({
		path: "",
		content: null,
		previousContent: null,
	});
	const [fileHistory, setFileHistory] = React.useState<
		Array<{
			type: "added" | "removed" | "modified";
			path: string;
			timestamp: number;
		}>
	>([]);
	const [isEditMode, setIsEditMode] = React.useState(false);
	const [editableContent, setEditableContent] = React.useState("");
	const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false);
	const [showCode, setShowCode] = React.useState(true);

	const {
		selectDirectory,
		connectShared,
		clear,
		files,
		isSupported,
		isBroadcasting,
		writeFile,
		readFile,
		startPolling,
		stopPolling,
		isPolling,
	} = useFs({
		filters: defaultFilters,
		broadcast: true,
		onChange: (changes: FileChange[]) => {
			const historyEntries = changes.map((change) => ({
				type:
					change.type === "deleted"
						? ("removed" as const)
						: (change.type as "added" | "modified"),
				path: change.type === "deleted" ? change.path : change.entry.path,
				timestamp: Date.now(),
			}));
			setFileHistory((prev) => [...historyEntries, ...prev].slice(0, 50));

			const modified = changes.find((c) => c.type === "modified");
			if (modified && modified.type === "modified") {
				handleFileSelectFromChange(modified.entry.path);
			}
		},
		onError: (error) => {
			console.error("File system error:", error);
		},
	});

	const [isLoading, setIsLoading] = React.useState(false);
	const [hasSharedHandle, setHasSharedHandle] = React.useState(false);

	// Check if a shared handle exists on mount
	React.useEffect(() => {
		retrieveHandle().then((handle) => {
			setHasSharedHandle(handle !== null);
		});
	}, []);

	const handleDirectorySelection = async () => {
		setIsLoading(true);
		try {
			await selectDirectory();
		} finally {
			setIsLoading(false);
		}
	};

	const handleConnectShared = async () => {
		setIsLoading(true);
		try {
			const connected = await connectShared();
			if (!connected) {
				// No shared handle available, fall back to picker
				await selectDirectory();
			}
		} finally {
			setIsLoading(false);
		}
	};

	const handleClear = () => {
		clear();
		setSelectedFile({ path: "", content: null, previousContent: null });
		setFileHistory([]);
	};

	const formatTimestamp = (timestamp: number) => {
		return new Date(timestamp).toLocaleTimeString([], {
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		});
	};

	const renderDiff = (oldContent: string | null, newContent: string | null) => {
		if (!(oldContent || newContent)) {
			return null;
		}
		if (!oldContent) {
			return newContent?.split("\n").map((line, i) => (
				<div key={i} className="text-emerald-500">
					+ {line}
				</div>
			));
		}
		if (!newContent) {
			return oldContent?.split("\n").map((line, i) => (
				<div key={i} className="text-red-500">
					- {line}
				</div>
			));
		}

		const oldLines = oldContent.split("\n");
		const newLines = newContent.split("\n");
		const diff: JSX.Element[] = [];

		let i = 0;
		let j = 0;
		while (i < oldLines.length || j < newLines.length) {
			if (
				i < oldLines.length &&
				j < newLines.length &&
				oldLines[i] === newLines[j]
			) {
				diff.push(
					<div key={`${i}-${j}`} className="text-zinc-400">
						{oldLines[i]}
					</div>,
				);
				i++;
				j++;
			} else {
				if (i < oldLines.length) {
					diff.push(
						<div key={`old-${i}`} className="text-red-500">
							- {oldLines[i]}
						</div>,
					);
					i++;
				}
				if (j < newLines.length) {
					diff.push(
						<div key={`new-${j}`} className="text-emerald-500">
							+ {newLines[j]}
						</div>,
					);
					j++;
				}
			}
		}
		return diff;
	};

	const handleFileSelectFromChange = async (path: FilePath) => {
		try {
			const content = await readFile(path);
			const previousContent =
				selectedFile.path === path ? selectedFile.content : null;
			setSelectedFile({ path, content, previousContent });
		} catch {}
	};

	const handleFileSelect = async (path: FilePath) => {
		try {
			const content = await readFile(path);
			setSelectedFile({ path, content, previousContent: null });
			setIsEditMode(false);
			setEditableContent(content);
			setHasUnsavedChanges(false);
		} catch (error) {
			console.error("Error reading file:", error);
		}
	};

	const handleSave = async () => {
		if (selectedFile.path) {
			try {
				if (!files.has(selectedFile.path as FilePath)) {
					throw new Error("Selected file no longer exists");
				}
				await writeFile(selectedFile.path as FilePath, editableContent);
				setSelectedFile((prev) => ({
					...prev,
					previousContent: prev.content,
					content: editableContent,
				}));
				setHasUnsavedChanges(false);
			} catch (error: unknown) {
				console.error("Error saving file:", error);
				alert(
					error instanceof Error
						? `Failed: ${error.message}`
						: "Failed to save",
				);
			}
		}
	};

	const codeExample = `import { useFs } from 'use-fs';

const { selectDirectory, connectShared, files } = useFs({
  broadcast: true, // Enable cross-tab sync
  onChange: (changes) => {
    changes.forEach(c => console.log(c.type, c.entry?.path));
  },
});

// Tab A: User picks directory (stored for other tabs)
await selectDirectory();

// Tab B: Connect without picker prompt
await connectShared();`;

	return (
		<div className="w-full space-y-2">
			{/* Compact Info Bar */}
			<div className="flex items-center justify-between rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900">
				<div className="flex items-center gap-4 text-[11px]">
					<span className="font-semibold text-zinc-900 dark:text-white">
						File System Access API
					</span>
					<span className="font-medium text-zinc-600 dark:text-zinc-300">
						Real files • Cross-tab sync • .gitignore
					</span>
					<span className="text-zinc-500 dark:text-zinc-400">
						Chrome, Edge, Opera
					</span>
				</div>
				<button
					type="button"
					onClick={() => setShowCode(!showCode)}
					className="font-medium text-[11px] text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
				>
					{showCode ? "Hide code" : "Show code"}
				</button>
			</div>

			{/* Description + Code */}
			{showCode && (
				<div className="grid w-full gap-2 lg:[grid-template-columns:1fr_1fr]">
					{/* README */}
					<div className="min-w-0 overflow-hidden rounded-md border border-zinc-200 bg-white p-3 text-left dark:border-zinc-700 dark:bg-zinc-900">
						<div className="prose prose-zinc prose-sm dark:prose-invert max-w-none text-[11px]">
							<p className="!mt-0 !mb-2 font-medium text-zinc-800 dark:text-zinc-200">
								Access the user's local file system with permission-based
								access.
							</p>
							<h4 className="!text-[11px] !font-bold !mt-2 !mb-1 text-zinc-900 dark:text-white">
								Features
							</h4>
							<ul className="!my-0 !pl-4 list-disc space-y-0.5 text-zinc-600 dark:text-zinc-400">
								<li>
									<code className="rounded bg-zinc-100 px-1 text-[10px] dark:bg-zinc-800">
										selectDirectory()
									</code>{" "}
									- Opens native folder picker
								</li>
								<li>
									<code className="rounded bg-zinc-100 px-1 text-[10px] dark:bg-zinc-800">
										connectShared()
									</code>{" "}
									- Connect to directory from another tab
								</li>
								<li>
									<code className="rounded bg-zinc-100 px-1 text-[10px] dark:bg-zinc-800">
										readFile(path)
									</code>{" "}
									/ writeFile - Read/write files
								</li>
								<li>
									<code className="rounded bg-zinc-100 px-1 text-[10px] dark:bg-zinc-800">
										isBroadcasting
									</code>{" "}
									- Cross-tab sync status
								</li>
							</ul>
							<h4 className="!text-[11px] !font-bold !mt-2 !mb-1 text-zinc-900 dark:text-white">
								Options
							</h4>
							<ul className="!my-0 !pl-4 list-disc space-y-0.5 text-zinc-600 dark:text-zinc-400">
								<li>
									<code className="rounded bg-zinc-100 px-1 text-[10px] dark:bg-zinc-800">
										broadcast
									</code>{" "}
									- Enable cross-tab sync
								</li>
								<li>
									<code className="rounded bg-zinc-100 px-1 text-[10px] dark:bg-zinc-800">
										filters
									</code>{" "}
									- .gitignore-style patterns
								</li>
								<li>
									<code className="rounded bg-zinc-100 px-1 text-[10px] dark:bg-zinc-800">
										onChange
									</code>{" "}
									- File change callback
								</li>
							</ul>
						</div>
					</div>
					{/* Code */}
					<div className="min-w-0 overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-700">
						<Highlight theme={themes.oneDark} code={codeExample} language="tsx">
							{({ className, style, tokens, getLineProps, getTokenProps }) => (
								<pre
									className={`${className} p-2 text-[11px] leading-relaxed`}
									style={style}
								>
									{tokens.map((line, i) => (
										<div key={i} {...getLineProps({ line })}>
											{line.map((token, key) => (
												<span key={key} {...getTokenProps({ token })} />
											))}
										</div>
									))}
								</pre>
							)}
						</Highlight>
					</div>
				</div>
			)}

			{/* Main Grid */}
			<div className="grid w-full gap-2 lg:[grid-template-columns:1fr_1fr]">
				{/* File Browser */}
				<div className="flex min-w-0 flex-col overflow-hidden rounded-md border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
					{/* Toolbar */}
					<div className="flex items-center justify-between border-zinc-200 border-b px-2 py-1.5 dark:border-zinc-700">
						<div className="flex items-center gap-1">
							<button
								type="button"
								onClick={handleDirectorySelection}
								disabled={isLoading}
								className="inline-flex items-center rounded bg-zinc-900 px-2 py-1 font-semibold text-[11px] text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
							>
								<svg
									className="mr-1 h-3 w-3"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<title>Select</title>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
									/>
								</svg>
								Select
							</button>
							{hasSharedHandle && files.size === 0 && (
								<button
									type="button"
									onClick={handleConnectShared}
									disabled={isLoading}
									className="inline-flex items-center rounded border border-blue-400 bg-blue-50 px-2 py-1 font-semibold text-[11px] text-blue-700 hover:bg-blue-100 disabled:opacity-50 dark:border-blue-600 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50"
									title="Connect to directory shared from another tab"
								>
									<svg
										className="mr-1 h-3 w-3"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<title>Connect</title>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
										/>
									</svg>
									Connect
								</button>
							)}
							<button
								type="button"
								onClick={handleClear}
								disabled={isLoading || files.size === 0}
								className="inline-flex items-center rounded border border-zinc-300 bg-white px-2 py-1 font-medium text-[11px] text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
							>
								Clear
							</button>
							<button
								type="button"
								onClick={isPolling ? stopPolling : startPolling}
								disabled={isLoading || files.size === 0}
								className={`inline-flex items-center rounded border px-2 py-1 font-semibold text-[11px] disabled:opacity-50 ${
									isPolling
										? "border-red-400 bg-red-50 text-red-700 dark:border-red-600 dark:bg-red-900/30 dark:text-red-300"
										: "border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300"
								}`}
							>
								{isPolling ? "Stop" : "Poll"}
							</button>
						</div>
						<div className="flex items-center gap-2 font-medium text-[11px] text-zinc-600 dark:text-zinc-300">
							{isBroadcasting && (
								<span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
									<svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
										<title>Syncing</title>
										<path d="M10 2a8 8 0 100 16 8 8 0 000-16zm0 14a6 6 0 110-12 6 6 0 010 12z" />
										<circle cx="10" cy="10" r="3" />
									</svg>
									Syncing
								</span>
							)}
							<span>{files.size} files</span>
							<div
								className={`h-2 w-2 rounded-full ${isPolling ? "animate-pulse bg-emerald-500" : "bg-zinc-400"}`}
							/>
						</div>
					</div>

					{/* File List */}
					{!isSupported && (
						<div className="m-2 rounded border border-amber-400 bg-amber-50 p-2 font-medium text-[11px] text-amber-800 dark:border-amber-600 dark:bg-amber-900/30 dark:text-amber-300">
							Browser not supported. Use Chrome or Edge.
						</div>
					)}
					<div className="h-[200px] overflow-y-auto p-1">
						{files.size === 0 ? (
							<div className="flex h-full items-center justify-center font-medium text-[11px] text-zinc-500 dark:text-zinc-400">
								Select a directory to browse
							</div>
						) : (
							Array.from(files.keys()).map((path) => (
								<button
									type="button"
									key={path}
									onClick={() => handleFileSelect(path)}
									className={`w-full rounded px-2 py-1 text-left font-medium text-[11px] hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
										selectedFile.path === path
											? "bg-zinc-100 dark:bg-zinc-800"
											: ""
									}`}
								>
									<span className="text-zinc-700 dark:text-zinc-300">
										{path}
									</span>
								</button>
							))
						)}
					</div>
				</div>

				{/* Editor/Viewer */}
				<div className="flex min-w-0 flex-col overflow-hidden rounded-md border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
					<div className="flex items-center justify-between border-zinc-200 border-b px-2 py-1.5 dark:border-zinc-700">
						<span className="truncate font-semibold text-[11px] text-zinc-800 dark:text-zinc-200">
							{selectedFile.path || "No file selected"}
						</span>
						{selectedFile.path && (
							<div className="flex items-center gap-1">
								{isEditMode && hasUnsavedChanges && (
									<button
										type="button"
										onClick={handleSave}
										className="rounded bg-emerald-500 px-2 py-0.5 font-semibold text-[11px] text-white hover:bg-emerald-600"
									>
										Save
									</button>
								)}
								<button
									type="button"
									onClick={() => {
										if (isEditMode && hasUnsavedChanges) {
											if (window.confirm("Discard changes?")) {
												setIsEditMode(false);
												setHasUnsavedChanges(false);
											}
										} else {
											setIsEditMode(!isEditMode);
											if (!isEditMode) {
												setEditableContent(selectedFile.content || "");
											}
										}
									}}
									className="rounded border border-zinc-300 bg-white px-2 py-0.5 font-medium text-[11px] text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
								>
									{isEditMode ? "View" : "Edit"}
								</button>
							</div>
						)}
					</div>
					<div className="h-[200px] overflow-auto p-2 font-mono text-[11px]">
						{isEditMode ? (
							<textarea
								value={editableContent}
								onChange={(e) => {
									setEditableContent(e.target.value);
									setHasUnsavedChanges(e.target.value !== selectedFile.content);
								}}
								className="h-full w-full resize-none bg-transparent font-medium text-zinc-800 focus:outline-none dark:text-zinc-200"
								placeholder="Edit file..."
							/>
						) : (
							<div className="font-medium text-zinc-600 dark:text-zinc-300">
								{selectedFile.content ? (
									renderDiff(selectedFile.previousContent, selectedFile.content)
								) : (
									<span className="text-zinc-500 dark:text-zinc-400">
										Click a file to view
									</span>
								)}
							</div>
						)}
					</div>
				</div>
			</div>

			{/* History - Compact horizontal */}
			{fileHistory.length > 0 && (
				<div className="flex items-center gap-2 overflow-x-auto rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900">
					<span className="shrink-0 font-semibold text-[11px] text-zinc-600 dark:text-zinc-300">
						History:
					</span>
					{fileHistory.slice(0, 8).map((entry, index) => (
						<div
							key={`${entry.path}-${entry.timestamp}-${index}`}
							className={`shrink-0 rounded px-1.5 py-0.5 font-medium text-[11px] ${
								entry.type === "added"
									? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
									: entry.type === "modified"
										? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
										: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
							}`}
						>
							{entry.path.split("/").pop()} · {formatTimestamp(entry.timestamp)}
						</div>
					))}
				</div>
			)}
		</div>
	);
};

export default FsaDemo;
