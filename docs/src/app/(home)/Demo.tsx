"use client";

import { Highlight, themes } from "prism-react-renderer";
import React, { type JSX } from "react";
import "react-install-command/styles.css";
import { InstallCommand } from "react-install-command";
import { commonFilters, useFs } from "use-fs";

type FileState = {
	path: string;
	content: string | null;
	previousContent: string | null;
};

const App = () => {
	const [selectedFile, setSelectedFile] = React.useState<FileState>({
		path: "",
		content: null,
		previousContent: null,
	});
	const [fileHistory, setFileHistory] = React.useState<
		Array<{
			type: "added" | "removed";
			path: string;
			timestamp: number;
		}>
	>([]);
	const [isEditMode, setIsEditMode] = React.useState(false);
	const [editableContent, setEditableContent] = React.useState("");
	const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false);

	const {
		onDirectorySelection,
		onClear,
		files,
		isBrowserSupported,
		writeFile,
		startPolling,
		stopPolling,
		isPolling,
	} = useFs({
		filters: commonFilters,
		onFilesAdded: (newFiles, previousFiles) => {
			console.log("onFilesAdded", newFiles, previousFiles);
			const newEntries = Array.from(newFiles.keys()).map((path) => ({
				type: "added" as const,
				path,
				timestamp: Date.now(),
			}));
			setFileHistory((prev) => [...newEntries, ...prev].slice(0, 50));
		},
		onFilesChanged: (changedFiles, previousFiles) => {
			console.log("onFilesChanged", changedFiles, previousFiles);

			const changedFilesArray = Array.from(changedFiles);
			if (changedFilesArray.length > 0) {
				const [filePath, content] = changedFilesArray[0];
				const previousContent = previousFiles.get(filePath) || null;
				setSelectedFile({ path: filePath, content, previousContent });
			}
		},
		onFilesDeleted: (deletedFiles, previousFiles) => {
			console.log("onFilesDeleted", deletedFiles, previousFiles);
			if (deletedFiles.has(selectedFile.path)) {
				setSelectedFile({ path: "", content: null, previousContent: null });
			}
			const deletedEntries = Array.from(deletedFiles.keys()).map((path) => ({
				type: "removed" as const,
				path,
				timestamp: Date.now(),
			}));
			setFileHistory((prev) => [...deletedEntries, ...prev].slice(0, 50));
		},
	});

	const [isLoading, setIsLoading] = React.useState(false);

	const handleDirectorySelection = async () => {
		setIsLoading(true);
		try {
			await onDirectorySelection();
		} finally {
			setIsLoading(false);
		}
	};

	const handleClear = () => {
		onClear();
		setSelectedFile({ path: "", content: null, previousContent: null });
		setFileHistory([]);
	};

	const formatTimestamp = (timestamp: number) => {
		return new Date(timestamp).toLocaleTimeString();
	};

	const renderDiff = (oldContent: string | null, newContent: string | null) => {
		if (!(oldContent || newContent)) {
			return null;
		}
		if (!oldContent) {
			// New file
			return newContent?.split("\n").map((line, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
				<div key={i} className="text-green-600">
					+ {line}
				</div>
			));
		}
		if (!newContent) {
			// Deleted file
			return oldContent?.split("\n").map((line, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
				<div key={i} className="text-red-600">
					- {line}
				</div>
			));
		}

		// Changed file - simple line by line diff
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
					<div key={`${i}-${j}`} className="text-gray-800 dark:text-gray-200">
						{" "}
						{oldLines[i]}
					</div>,
				);
				i++;
				j++;
			} else {
				if (i < oldLines.length) {
					diff.push(
						<div key={`old-${i}`} className="text-red-600">
							- {oldLines[i]}
						</div>,
					);
					i++;
				}
				if (j < newLines.length) {
					diff.push(
						<div key={`new-${j}`} className="text-green-600">
							+ {newLines[j]}
						</div>,
					);
					j++;
				}
			}
		}

		return diff;
	};

	const handleFileSelect = (path: string) => {
		const content = files.get(path) || null;
		setSelectedFile({
			path,
			content,
			previousContent: null,
		});
		setIsEditMode(false);
		setEditableContent(content || "");
		setHasUnsavedChanges(false);
	};

	const handleSave = async () => {
		if (selectedFile.path) {
			try {
				// Validate the selected file path
				if (!files.has(selectedFile.path)) {
					throw new Error("Selected file no longer exists");
				}

				await writeFile(selectedFile.path, editableContent);
				setSelectedFile((prev) => ({
					...prev,
					previousContent: prev.content,
					content: editableContent,
				}));
				setHasUnsavedChanges(false);
			} catch (error: unknown) {
				console.error("Error saving file:", error);
				if (error instanceof Error) {
					alert(`Failed to save file: ${error.message}`);
				} else {
					alert("Failed to save file: An unknown error occurred");
				}
			}
		}
	};

	return (
		<main className="container mx-auto py-8 font-mono sm:py-10">
			<div className="space-y-8">
				{/* Header Section */}
				<header className="space-y-8 border-zinc-200 border-b pb-8 dark:border-zinc-800">
					<div className="grid grid-cols-1 gap-8 text-left md:grid-cols-2">
						<div className="rounded-lg border border-zinc-200 bg-white p-6 pt-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
							<div className="flex h-full flex-col">
								<div className="flex-1">
									<p className="mt-4 text-left text-xl text-zinc-600 dark:text-zinc-400">
										A React hook for integrating with the{" "}
										<a
											href="https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API"
											className="text-emerald-500 dark:text-emerald-400"
										>
											File System Access API
										</a>
										.{" "}
									</p>
									<p className="mt-2 text-sm text-zinc-400 dark:text-zinc-600">
										Supported on Desktop in Chrome, Edge and Opera.
									</p>
									<div className="mt-2 sm:mt-4">
										<InstallCommand
											packageName="use-fs"
											slotClassNames={{
												root: "!rounded-lg !border !border-zinc-200 dark:!border-zinc-800 !bg-white dark:!bg-zinc-800/50 !overflow-hidden",
												navigation:
													"!bg-zinc-200/75 dark:!bg-zinc-800 !border-b !border-zinc-200 dark:!border-zinc-800 !p-1 sm:!p-2 !px-0 !flex !flex-row !flex-wrap !items-center !min-h-fit",
												tab: "!px-2 sm:!px-3 !py-1 sm:!py-1.5 !text-xs sm:!text-sm !rounded-md !text-zinc-600 hover:!text-zinc-800 dark:!text-zinc-400 dark:hover:!text-zinc-400 data-[selected=true]:!bg-white dark:data-[selected=true]:!bg-zinc-800/50 data-[selected=true]:!text-zinc-900 dark:data-[selected=true]:!text-zinc-400 !whitespace-nowrap !-mb-2",
												tabIcon: "!w-4 !h-4 !mr-1.5",
												tabText: "!text-zinc-600 dark:!text-zinc-400",
												commandContainer:
													"!bg-zinc-100 dark:!bg-zinc-900 !border !border-zinc-200 dark:!border-zinc-800 !p-2 sm:!p-3 !flex !flex-wrap !items-center !gap-1 sm:!gap-2",
												commandGroup: "!flex !items-center !gap-1",
												commandPrefix:
													"!text-zinc-500 !shrink-0 !text-xs sm:!text-sm !dark:text-zinc-500 !mr-2",
												commandText:
													"!text-zinc-500 !shrink-0 !text-sm sm:!text-sm !dark:text-zinc-500 !mr-2",

												copyButton:
													"!ml-auto !p-1 sm:!p-1.5 !rounded-md hover:!bg-zinc-100 dark:hover:!bg-zinc-800/50 !text-zinc-600 hover:!text-zinc-800 dark:!text-zinc-400 dark:hover:!text-zinc-400 !shrink-0",
												copyButtonIcon: "!w-4 !h-4",
												tabIndicator: "!bg-zinc-900 dark:!bg-zinc-100 ",
												commandTextCommand:
													"!text-zinc-500 !shrink-0 !text-xs sm:!text-sm !dark:text-zinc-500 !mr-2",
											}}
										/>
									</div>
									<p className="mt-2 text-left text-base text-zinc-600 sm:mt-4 sm:text-lg dark:text-zinc-400">
										The File System Access API enables web applications to
										seamlessly work with files on a user's local system.
									</p>
									<p className="mt-4 text-left text-lg text-zinc-600 dark:text-zinc-400">
										Build web-apps that can read, write, and manage files
										directly - eliminating the need for repeated file selection
										dialogs. This capability is ideal for creating powerful
										browser-based tools.
									</p>
									<p className="mt-4 text-left text-lg text-zinc-600 dark:text-zinc-400">
										Unlike a traditional file selection dialog, the user will be
										prompted to give the web-browser permission to access a
										specific directory. Once permission is granted the hook will
										watch the files in that directory for updates, triggering a
										re-render whenever a file is added, changed or deleted.
									</p>
								</div>
								<button
									type="button"
									onClick={() => {
										window.scrollTo({
											top: window.innerHeight,
											behavior: "smooth",
										});
									}}
									className="mt-8 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-100 transition-colors hover:bg-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
								>
									<span className="mr-2 font-bold text-zinc-100 dark:text-zinc-100">
										↓
									</span>
									Check out the demo
									<span className="ml-2 font-bold text-zinc-100 dark:text-zinc-100">
										↓
									</span>
								</button>
							</div>
						</div>

						{/* Code Example */}
						<div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
							<div className="border-zinc-200 border-b px-4 py-3 dark:border-zinc-800">
								<div className="flex items-center gap-2">
									<div className="h-3 w-3 rounded-full bg-red-500" />
									<div className="h-3 w-3 rounded-full bg-yellow-500" />
									<div className="h-3 w-3 rounded-full bg-green-500" />
								</div>
							</div>
							<div className="overflow-x-auto text-left">
								<Highlight
									theme={themes.oneDark}
									code={`import { useFs } from 'use-fs';

function App() {
  const { 
    onDirectorySelection, 
    files,
    isBrowserSupported 
  } = useFs({
    onFilesAdded: (newFiles, previousFiles) => {
      console.log('Files added:', newFiles);
    },
    onFilesChanged: (changedFiles, previousFiles) => {
      console.log('Files changed:', changedFiles);
    },
    onFilesDeleted: (deletedFiles, previousFiles) => {
      console.log('Files deleted:', deletedFiles);
    },
  });

  if (!isBrowserSupported) {
    return <div>Browser not supported</div>;
  }

  return (
    <div>
      <button onClick={onDirectorySelection}>
        Select Directory
      </button>
	  {files.size > 0 && (
		<div>
			{Array.from(files.keys()).map((path) => (
				<div key={path}>{path}</div>
			))}
		</div>
	  )}
    </div>
  );
}`}
									language="tsx"
								>
									{({
										className,
										style,
										tokens,
										getLineProps,
										getTokenProps,
									}) => (
										<pre className={`${className} p-4 text-sm`} style={style}>
											{tokens.map((line, i) => (
												// biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
												<div key={i} {...getLineProps({ line })}>
													{line.map((token, key) => (
														// biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
														<span key={key} {...getTokenProps({ token })} />
													))}
												</div>
											))}
										</pre>
									)}
								</Highlight>
							</div>
						</div>
					</div>
				</header>

				{/* Main Content */}
				<div className="grid gap-6 lg:grid-cols-2">
					{/* Left Panel: File Browser */}
					<div className="flex flex-col rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
						{/* Toolbar */}
						<div className="border-zinc-200 border-b p-4 dark:border-zinc-800">
							<div className="flex items-center justify-between">
								<div className="flex items-center space-x-2">
									<button
										type="button"
										onClick={handleDirectorySelection}
										disabled={isLoading}
										className="inline-flex items-center rounded-md bg-zinc-900 px-2 py-1 font-medium text-white text-xs hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:focus:ring-zinc-300 dark:hover:bg-zinc-200"
									>
										<svg
											className="mr-1 h-3 w-3"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
										>
											<title>Select directory icon</title>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
											/>
										</svg>
										Select Directory
									</button>
									<button
										type="button"
										onClick={handleClear}
										disabled={isLoading || files.size === 0}
										className="inline-flex items-center rounded-md border border-zinc-300 bg-white px-2 py-1 font-medium text-xs text-zinc-700 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
									>
										<svg
											className="mr-1 h-3 w-3"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
										>
											<title>Clear directory icon</title>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
											/>
										</svg>
										Clear
									</button>
									{isPolling ? (
										<button
											type="button"
											onClick={stopPolling}
											disabled={isLoading}
											className="inline-flex items-center rounded-md border border-red-300 bg-red-50 px-2 py-1 font-medium text-red-700 text-xs hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-700/50 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
										>
											<svg
												className="mr-1 h-3 w-3"
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
											>
												<title>Stop polling icon</title>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z M9 10l6 6m0-6l-6 6"
												/>
											</svg>
											Stop Polling
										</button>
									) : (
										<button
											type="button"
											onClick={startPolling}
											disabled={isLoading || files.size === 0}
											className="inline-flex items-center rounded-md border border-green-300 bg-green-50 px-2 py-1 font-medium text-green-700 text-xs hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-green-700/50 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/30"
										>
											<svg
												className="mr-1 h-3 w-3"
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
											>
												<title>Start polling icon</title>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1.586a1 1 0 01.707.293l2.414 2.414a1 1 0 00.707.293H15M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
												/>
											</svg>
											Start Polling
										</button>
									)}
								</div>
								<div className="flex items-center space-x-3 text-sm text-zinc-500 dark:text-zinc-400">
									<span>{files.size} files</span>
									<div className="flex items-center space-x-1">
										<div
											className={`h-2 w-2 rounded-full ${
												isPolling ? "animate-pulse bg-green-500" : "bg-gray-400"
											}`}
										/>
										<span className="text-xs">
											{isPolling ? "Polling Active" : "Polling Stopped"}
										</span>
									</div>
								</div>
							</div>
						</div>

						{/* File List */}
						<div className="flex-1 overflow-hidden">
							{!isBrowserSupported && (
								<div className="m-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-700 text-sm dark:border-amber-500/20 dark:bg-amber-900/10 dark:text-amber-400">
									<div className="flex items-center">
										<svg
											className="mr-2 h-4 w-4"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
										>
											<title>Warning icon</title>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
											/>
										</svg>
										Your browser does not support the File System Access API.
										Please try again in Chrome or Edge.
									</div>
								</div>
							)}
							<div className="h-[calc(100vh-400px)] overflow-y-auto p-1 text-left">
								{Array.from(files.keys()).map((path) => (
									<button
										type="button"
										key={path}
										className="group relative w-full rounded-lg px-2 py-1.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
										onClick={() => handleFileSelect(path)}
									>
										<div className="flex items-center">
											<svg
												className="mr-1.5 h-3 w-3 text-zinc-400"
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
											>
												<title>File icon</title>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
												/>
											</svg>
											<span className="text-xs text-zinc-700 dark:text-zinc-300">
												{path}
											</span>
										</div>
									</button>
								))}
							</div>
						</div>
					</div>

					{/* Right Panel: Diff Viewer */}
					<div className="flex flex-col rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
						<div className="border-zinc-200 border-b p-4 dark:border-zinc-800">
							<div className="flex items-center justify-between">
								<div className="flex items-center">
									<svg
										className="mr-2 h-4 w-4 text-zinc-400"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<title>Current file icon</title>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
										/>
									</svg>
									<span className="font-medium text-zinc-900 dark:text-zinc-100">
										{selectedFile.path ||
											"Click a file to view a real-time diff"}
									</span>
								</div>
								{selectedFile.path && (
									<div className="flex items-center gap-2">
										{isEditMode && hasUnsavedChanges && (
											<button
												type="button"
												onClick={handleSave}
												className="inline-flex items-center rounded-md bg-emerald-500 px-2 py-1 font-medium text-white text-xs hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:bg-emerald-600 dark:hover:bg-emerald-700"
											>
												<svg
													className="mr-1 h-3 w-3"
													fill="none"
													viewBox="0 0 24 24"
													stroke="currentColor"
												>
													<title>Save changes</title>
													<path
														strokeLinecap="round"
														strokeLinejoin="round"
														strokeWidth={2}
														d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
													/>
												</svg>
												Save
											</button>
										)}
										<button
											type="button"
											onClick={() => {
												if (isEditMode && hasUnsavedChanges) {
													if (window.confirm("Discard unsaved changes?")) {
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
											className="inline-flex items-center rounded-md border border-zinc-300 bg-white px-2 py-1 font-medium text-xs text-zinc-700 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
										>
											<svg
												className="mr-1 h-3 w-3"
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
											>
												<title>{isEditMode ? "View mode" : "Edit mode"}</title>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d={
														isEditMode
															? "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
															: "M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
													}
												/>
											</svg>
											{isEditMode ? "View" : "Edit"}
										</button>
									</div>
								)}
							</div>
						</div>
						<div className="flex-1 overflow-hidden">
							<div className="h-[calc(100vh-400px)] overflow-y-auto p-4 text-left font-mono text-sm">
								{isEditMode ? (
									<textarea
										value={editableContent}
										onChange={(e) => {
											setEditableContent(e.target.value);
											setHasUnsavedChanges(
												e.target.value !== selectedFile.content,
											);
										}}
										className="h-full w-full resize-none rounded-lg border border-zinc-200 bg-zinc-50 p-4 font-mono text-sm focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-300 dark:focus:border-zinc-700"
										placeholder="Edit file content..."
									/>
								) : (
									<div className="rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800/50">
										{renderDiff(
											selectedFile.previousContent,
											selectedFile.content,
										)}
									</div>
								)}
							</div>
						</div>
					</div>
				</div>

				{/* File History */}
				<div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
					<div className="border-zinc-200 border-b p-4 dark:border-zinc-800">
						<h2 className="font-medium text-zinc-900 dark:text-zinc-100">
							File History
						</h2>
					</div>
					<div className="p-4">
						<div className="max-h-[200px] space-y-2 overflow-y-auto">
							{fileHistory.map((entry, index) => (
								<div
									key={`${entry.path}-${entry.timestamp}-${index}`}
									className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2 dark:border-zinc-800 dark:bg-zinc-800/50"
								>
									<div className="flex items-center space-x-3">
										<svg
											className="h-4 w-4"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
										>
											<title>History action icon</title>
											{entry.type === "added" ? (
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M12 4v16m8-8H4"
												/>
											) : (
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M6 18L18 6M6 6l12 12"
												/>
											)}
										</svg>
										<span
											className={`text-sm ${
												entry.type === "added"
													? "text-emerald-700 dark:text-emerald-400"
													: "text-red-700 dark:text-red-400"
											}`}
										>
											{entry.path}
										</span>
									</div>
									<span className="text-xs text-zinc-500 dark:text-zinc-400">
										{formatTimestamp(entry.timestamp)}
									</span>
								</div>
							))}
						</div>
					</div>
				</div>

				{/* Footer */}
				<div className="pt-5 text-center text-sm text-zinc-400">
					Built by{" "}
					<a
						href="https://linesofcode.dev"
						target="_blank"
						rel="noopener noreferrer"
						className="text-emerald-400 transition-colors hover:text-emerald-300"
					>
						linesofcode.dev
					</a>
				</div>
			</div>
		</main>
	);
};

export default App;
