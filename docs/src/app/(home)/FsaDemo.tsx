"use client";

import { Highlight, themes } from "prism-react-renderer";
import React, { type JSX } from "react";
import { type FileChange, type FilePath, defaultFilters, useFs } from "use-fs";

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
		clear,
		files,
		isSupported,
		writeFile,
		readFile,
		startPolling,
		stopPolling,
		isPolling,
	} = useFs({
		filters: defaultFilters,
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

	const handleDirectorySelection = async () => {
		setIsLoading(true);
		try {
			await selectDirectory();
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
		return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
	};

	const renderDiff = (oldContent: string | null, newContent: string | null) => {
		if (!(oldContent || newContent)) return null;
		if (!oldContent) {
			return newContent?.split("\n").map((line, i) => (
				<div key={i} className="text-emerald-500">+ {line}</div>
			));
		}
		if (!newContent) {
			return oldContent?.split("\n").map((line, i) => (
				<div key={i} className="text-red-500">- {line}</div>
			));
		}

		const oldLines = oldContent.split("\n");
		const newLines = newContent.split("\n");
		const diff: JSX.Element[] = [];

		let i = 0, j = 0;
		while (i < oldLines.length || j < newLines.length) {
			if (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
				diff.push(<div key={`${i}-${j}`} className="text-zinc-400">{oldLines[i]}</div>);
				i++; j++;
			} else {
				if (i < oldLines.length) {
					diff.push(<div key={`old-${i}`} className="text-red-500">- {oldLines[i]}</div>);
					i++;
				}
				if (j < newLines.length) {
					diff.push(<div key={`new-${j}`} className="text-emerald-500">+ {newLines[j]}</div>);
					j++;
				}
			}
		}
		return diff;
	};

	const handleFileSelectFromChange = async (path: FilePath) => {
		try {
			const content = await readFile(path);
			const previousContent = selectedFile.path === path ? selectedFile.content : null;
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
				alert(error instanceof Error ? `Failed: ${error.message}` : "Failed to save");
			}
		}
	};

	const codeExample = `import { useFs } from 'use-fs';

const { selectDirectory, files, readFile } = useFs({
  onChange: (changes) => {
    changes.forEach(c => console.log(c.type, c.entry?.path));
  },
});`;

	return (
		<div className="space-y-2">
			{/* Compact Info Bar */}
			<div className="flex items-center justify-between rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900">
				<div className="flex items-center gap-4 text-[11px]">
					<span className="font-semibold text-zinc-900 dark:text-white">File System Access API</span>
					<span className="font-medium text-zinc-600 dark:text-zinc-300">Real files • Polling • .gitignore</span>
					<span className="text-zinc-500 dark:text-zinc-400">Chrome, Edge, Opera</span>
				</div>
				<button
					type="button"
					onClick={() => setShowCode(!showCode)}
					className="text-[11px] font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
				>
					{showCode ? "Hide code" : "Show code"}
				</button>
			</div>

			{/* Description + Code */}
			{showCode && (
				<div className="grid gap-2 lg:grid-cols-2">
					{/* README */}
					<div className="overflow-auto rounded-md border border-zinc-200 bg-white p-3 text-left dark:border-zinc-700 dark:bg-zinc-900">
						<div className="prose prose-zinc prose-sm dark:prose-invert max-w-none text-[11px]">
							<p className="font-medium text-zinc-800 dark:text-zinc-200 !mt-0 !mb-2">
								Access the user's local file system with permission-based access.
							</p>
							<h4 className="!text-[11px] !font-bold !mt-2 !mb-1 text-zinc-900 dark:text-white">Features</h4>
							<ul className="!my-0 !pl-4 space-y-0.5 text-zinc-600 dark:text-zinc-400 list-disc">
								<li><code className="text-[10px] bg-zinc-100 dark:bg-zinc-800 px-1 rounded">selectDirectory()</code> - Opens native folder picker</li>
								<li><code className="text-[10px] bg-zinc-100 dark:bg-zinc-800 px-1 rounded">readFile(path)</code> - Lazy content loading</li>
								<li><code className="text-[10px] bg-zinc-100 dark:bg-zinc-800 px-1 rounded">writeFile(path, content)</code> - Write back to disk</li>
								<li><code className="text-[10px] bg-zinc-100 dark:bg-zinc-800 px-1 rounded">startPolling()</code> - Watch for changes</li>
							</ul>
							<h4 className="!text-[11px] !font-bold !mt-2 !mb-1 text-zinc-900 dark:text-white">Options</h4>
							<ul className="!my-0 !pl-4 space-y-0.5 text-zinc-600 dark:text-zinc-400 list-disc">
								<li><code className="text-[10px] bg-zinc-100 dark:bg-zinc-800 px-1 rounded">filters</code> - .gitignore-style patterns</li>
								<li><code className="text-[10px] bg-zinc-100 dark:bg-zinc-800 px-1 rounded">onChange</code> - File change callback</li>
								<li><code className="text-[10px] bg-zinc-100 dark:bg-zinc-800 px-1 rounded">pollInterval</code> - Default 1000ms</li>
							</ul>
						</div>
					</div>
					{/* Code */}
					<div className="overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-700">
						<Highlight theme={themes.oneDark} code={codeExample} language="tsx">
							{({ className, style, tokens, getLineProps, getTokenProps }) => (
								<pre className={`${className} p-2 text-[11px] leading-relaxed`} style={style}>
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
			<div className="grid gap-2 lg:grid-cols-2">
				{/* File Browser */}
				<div className="flex flex-col overflow-hidden rounded-md border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
					{/* Toolbar */}
					<div className="flex items-center justify-between border-zinc-200 border-b px-2 py-1.5 dark:border-zinc-700">
						<div className="flex items-center gap-1">
							<button
								type="button"
								onClick={handleDirectorySelection}
								disabled={isLoading}
								className="inline-flex items-center rounded bg-zinc-900 px-2 py-1 text-[11px] font-semibold text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
							>
								<svg className="mr-1 h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<title>Select</title>
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
								</svg>
								Select
							</button>
							<button
								type="button"
								onClick={handleClear}
								disabled={isLoading || files.size === 0}
								className="inline-flex items-center rounded border border-zinc-300 bg-white px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
							>
								Clear
							</button>
							<button
								type="button"
								onClick={isPolling ? stopPolling : startPolling}
								disabled={isLoading || files.size === 0}
								className={`inline-flex items-center rounded border px-2 py-1 text-[11px] font-semibold disabled:opacity-50 ${
									isPolling
										? "border-red-400 bg-red-50 text-red-700 dark:border-red-600 dark:bg-red-900/30 dark:text-red-300"
										: "border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300"
								}`}
							>
								{isPolling ? "Stop" : "Poll"}
							</button>
						</div>
						<div className="flex items-center gap-2 text-[11px] font-medium text-zinc-600 dark:text-zinc-300">
							<span>{files.size} files</span>
							<div className={`h-2 w-2 rounded-full ${isPolling ? "animate-pulse bg-emerald-500" : "bg-zinc-400"}`} />
						</div>
					</div>

					{/* File List */}
					{!isSupported && (
						<div className="m-2 rounded border border-amber-400 bg-amber-50 p-2 text-[11px] font-medium text-amber-800 dark:border-amber-600 dark:bg-amber-900/30 dark:text-amber-300">
							Browser not supported. Use Chrome or Edge.
						</div>
					)}
					<div className="h-[200px] overflow-y-auto p-1">
						{files.size === 0 ? (
							<div className="flex h-full items-center justify-center text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
								Select a directory to browse
							</div>
						) : (
							Array.from(files.keys()).map((path) => (
								<button
									type="button"
									key={path}
									onClick={() => handleFileSelect(path)}
									className={`w-full rounded px-2 py-1 text-left text-[11px] font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
										selectedFile.path === path ? "bg-zinc-100 dark:bg-zinc-800" : ""
									}`}
								>
									<span className="text-zinc-700 dark:text-zinc-300">{path}</span>
								</button>
							))
						)}
					</div>
				</div>

				{/* Editor/Viewer */}
				<div className="flex flex-col overflow-hidden rounded-md border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
					<div className="flex items-center justify-between border-zinc-200 border-b px-2 py-1.5 dark:border-zinc-700">
						<span className="truncate text-[11px] font-semibold text-zinc-800 dark:text-zinc-200">
							{selectedFile.path || "No file selected"}
						</span>
						{selectedFile.path && (
							<div className="flex items-center gap-1">
								{isEditMode && hasUnsavedChanges && (
									<button
										type="button"
										onClick={handleSave}
										className="rounded bg-emerald-500 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-emerald-600"
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
											if (!isEditMode) setEditableContent(selectedFile.content || "");
										}
									}}
									className="rounded border border-zinc-300 bg-white px-2 py-0.5 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
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
									<span className="text-zinc-500 dark:text-zinc-400">Click a file to view</span>
								)}
							</div>
						)}
					</div>
				</div>
			</div>

			{/* History - Compact horizontal */}
			{fileHistory.length > 0 && (
				<div className="flex items-center gap-2 overflow-x-auto rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900">
					<span className="shrink-0 text-[11px] font-semibold text-zinc-600 dark:text-zinc-300">History:</span>
					{fileHistory.slice(0, 8).map((entry, index) => (
						<div
							key={`${entry.path}-${entry.timestamp}-${index}`}
							className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium ${
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
