"use client";

import { Highlight, themes } from "prism-react-renderer";
import React from "react";
import { type OpfsPath, toOpfsPath, useOpfs } from "use-fs";

const OpfsDemo = () => {
	const [newFileName, setNewFileName] = React.useState("");
	const [newFileContent, setNewFileContent] = React.useState("");
	const [selectedFile, setSelectedFile] = React.useState<{
		path: OpfsPath;
		content: string;
	} | null>(null);
	const [editContent, setEditContent] = React.useState("");
	const [showCode, setShowCode] = React.useState(true);

	const {
		files,
		isSupported,
		isScanning,
		isBroadcasting,
		scan,
		readFile,
		writeFile,
		deleteFile,
		clear,
	} = useOpfs({
		scan: true,
		broadcast: true,
		onChange: (changes) => {
			for (const change of changes) {
				if (change.type === "added" || change.type === "modified") {
					console.log(`OPFS ${change.type}:`, change.entry.path);
				} else {
					console.log("OPFS deleted:", change.path);
				}
			}
		},
	});

	const handleCreateFile = async () => {
		if (!newFileName.trim()) {
			return;
		}
		const path = toOpfsPath(`/${newFileName.trim()}`);
		await writeFile(path, newFileContent);
		setNewFileName("");
		setNewFileContent("");
		await scan();
	};

	const handleSelectFile = async (path: OpfsPath) => {
		const content = await readFile(path);
		setSelectedFile({ path, content });
		setEditContent(content);
	};

	const handleSaveFile = async () => {
		if (!selectedFile) {
			return;
		}
		await writeFile(selectedFile.path, editContent);
		setSelectedFile({ ...selectedFile, content: editContent });
		await scan();
	};

	const handleDeleteFile = async (path: OpfsPath) => {
		await deleteFile(path);
		if (selectedFile?.path === path) {
			setSelectedFile(null);
		}
		await scan();
	};

	const handleClearAll = () => {
		clear();
		setSelectedFile(null);
	};

	const formatSize = (bytes: number) => {
		if (bytes < 1024) {
			return `${bytes}B`;
		}
		if (bytes < 1024 * 1024) {
			return `${(bytes / 1024).toFixed(1)}KB`;
		}
		return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
	};

	const codeExample = `import { useOpfs, toOpfsPath } from 'use-fs';

const { files, writeFile, readFile, isBroadcasting } = useOpfs({
  scan: true,      // Auto-scan on mount
  broadcast: true, // Cross-tab sync via BroadcastChannel
  onChange: (changes) => console.log(changes),
});

// Write a file (creates parent dirs automatically)
await writeFile(toOpfsPath('/notes/todo.txt'), 'Hello OPFS!');

// Read file content
const content = await readFile(toOpfsPath('/notes/todo.txt'));`;

	return (
		<div className="space-y-2">
			{/* Header with toggle */}
			<div className="flex items-center justify-between rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900">
				<div className="flex items-center gap-4 text-[11px]">
					<span className="font-semibold text-zinc-900 dark:text-white">
						Origin Private File System
					</span>
					<span className="font-medium text-zinc-600 dark:text-zinc-300">
						No prompts • Persistent • Cross-tab sync
					</span>
					<span className="text-zinc-500 dark:text-zinc-400">All browsers</span>
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
				<div className="grid gap-2 lg:grid-cols-2">
					{/* README */}
					<div className="overflow-auto rounded-md border border-zinc-200 bg-white p-3 text-left dark:border-zinc-700 dark:bg-zinc-900">
						<div className="prose prose-zinc prose-sm dark:prose-invert max-w-none text-[11px]">
							<p className="!mt-0 !mb-2 font-medium text-zinc-800 dark:text-zinc-200">
								Sandboxed filesystem for web apps - no permission prompts
								required.
							</p>
							<h4 className="!text-[11px] !font-bold !mt-2 !mb-1 text-zinc-900 dark:text-white">
								Features
							</h4>
							<ul className="!my-0 !pl-4 list-disc space-y-0.5 text-zinc-600 dark:text-zinc-400">
								<li>
									<code className="rounded bg-zinc-100 px-1 text-[10px] dark:bg-zinc-800">
										writeFile(path, content)
									</code>{" "}
									- Auto-creates parent dirs
								</li>
								<li>
									<code className="rounded bg-zinc-100 px-1 text-[10px] dark:bg-zinc-800">
										readFile(path)
									</code>{" "}
									- Read file as string
								</li>
								<li>
									<code className="rounded bg-zinc-100 px-1 text-[10px] dark:bg-zinc-800">
										deleteFile(path)
									</code>{" "}
									- Remove files
								</li>
								<li>
									<code className="rounded bg-zinc-100 px-1 text-[10px] dark:bg-zinc-800">
										scan()
									</code>{" "}
									- Refresh file list
								</li>
							</ul>
							<h4 className="!text-[11px] !font-bold !mt-2 !mb-1 text-zinc-900 dark:text-white">
								Options
							</h4>
							<ul className="!my-0 !pl-4 list-disc space-y-0.5 text-zinc-600 dark:text-zinc-400">
								<li>
									<code className="rounded bg-zinc-100 px-1 text-[10px] dark:bg-zinc-800">
										scan: true
									</code>{" "}
									- Auto-scan on mount
								</li>
								<li>
									<code className="rounded bg-zinc-100 px-1 text-[10px] dark:bg-zinc-800">
										broadcast: true
									</code>{" "}
									- Cross-tab sync
								</li>
								<li>
									<code className="rounded bg-zinc-100 px-1 text-[10px] dark:bg-zinc-800">
										basePath
									</code>{" "}
									- Root directory
								</li>
							</ul>
						</div>
					</div>
					{/* Code */}
					<div className="overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-700">
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
			<div className="grid gap-2 lg:grid-cols-2">
				{/* File Browser */}
				<div className="flex flex-col overflow-hidden rounded-md border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
					{/* Toolbar */}
					<div className="flex items-center justify-between border-zinc-200 border-b px-2 py-1.5 dark:border-zinc-700">
						<div className="flex items-center gap-1">
							<button
								type="button"
								onClick={() => scan()}
								disabled={isScanning}
								className="inline-flex items-center rounded bg-zinc-900 px-2 py-1 font-semibold text-[11px] text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
							>
								{isScanning ? "..." : "Scan"}
							</button>
							<button
								type="button"
								onClick={handleClearAll}
								disabled={files.size === 0}
								className="inline-flex items-center rounded border border-zinc-300 bg-white px-2 py-1 font-medium text-[11px] text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
							>
								Clear
							</button>
						</div>
						<div className="flex items-center gap-2 font-medium text-[11px] text-zinc-600 dark:text-zinc-300">
							<span>{files.size} files</span>
							<div
								className={`h-2 w-2 rounded-full ${isBroadcasting ? "animate-pulse bg-blue-500" : "bg-zinc-400"}`}
							/>
						</div>
					</div>

					{/* Create New File */}
					<div className="flex items-center gap-1 border-zinc-200 border-b px-2 py-1.5 dark:border-zinc-700">
						<input
							type="text"
							placeholder="filename.txt"
							value={newFileName}
							onChange={(e) => setNewFileName(e.target.value)}
							className="flex-1 rounded border border-zinc-300 bg-white px-2 py-1 font-medium text-[11px] text-zinc-800 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:placeholder:text-zinc-500"
						/>
						<input
							type="text"
							placeholder="content"
							value={newFileContent}
							onChange={(e) => setNewFileContent(e.target.value)}
							className="flex-1 rounded border border-zinc-300 bg-white px-2 py-1 font-medium text-[11px] text-zinc-800 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:placeholder:text-zinc-500"
						/>
						<button
							type="button"
							onClick={handleCreateFile}
							disabled={!newFileName.trim()}
							className="rounded bg-emerald-600 px-2 py-1 font-semibold text-[11px] text-white hover:bg-emerald-700 disabled:opacity-50"
						>
							+
						</button>
					</div>

					{/* File List */}
					{!isSupported && (
						<div className="m-2 rounded border border-amber-400 bg-amber-50 p-2 font-medium text-[11px] text-amber-800 dark:border-amber-600 dark:bg-amber-900/30 dark:text-amber-300">
							OPFS not supported in this browser.
						</div>
					)}
					<div className="h-[200px] overflow-y-auto p-1">
						{files.size === 0 ? (
							<div className="flex h-full items-center justify-center font-medium text-[11px] text-zinc-500 dark:text-zinc-400">
								Create a file above
							</div>
						) : (
							Array.from(files.entries()).map(([path, entry]) => (
								<div
									key={path}
									className={`group flex items-center justify-between rounded px-2 py-1 ${
										selectedFile?.path === path
											? "bg-emerald-50 dark:bg-emerald-900/30"
											: "hover:bg-zinc-100 dark:hover:bg-zinc-800"
									}`}
								>
									<button
										type="button"
										onClick={() => handleSelectFile(path)}
										className="flex flex-1 items-center gap-2 text-left font-medium text-[11px]"
									>
										<span className="text-zinc-700 dark:text-zinc-300">
											{path}
										</span>
										<span className="text-zinc-500 dark:text-zinc-400">
											{formatSize(entry.size)}
										</span>
									</button>
									<button
										type="button"
										onClick={() => handleDeleteFile(path)}
										className="rounded p-0.5 text-red-500 opacity-0 hover:bg-red-50 group-hover:opacity-100 dark:text-red-400 dark:hover:bg-red-900/30"
									>
										<svg
											className="h-3 w-3"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
										>
											<title>Delete</title>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M6 18L18 6M6 6l12 12"
											/>
										</svg>
									</button>
								</div>
							))
						)}
					</div>
				</div>

				{/* Editor */}
				<div className="flex flex-col overflow-hidden rounded-md border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
					<div className="flex items-center justify-between border-zinc-200 border-b px-2 py-1.5 dark:border-zinc-700">
						<span className="truncate font-semibold text-[11px] text-zinc-800 dark:text-zinc-200">
							{selectedFile?.path || "No file selected"}
						</span>
						{selectedFile && editContent !== selectedFile.content && (
							<button
								type="button"
								onClick={handleSaveFile}
								className="rounded bg-emerald-500 px-2 py-0.5 font-semibold text-[11px] text-white hover:bg-emerald-600"
							>
								Save
							</button>
						)}
					</div>
					<div className="h-[200px] overflow-auto p-2 font-mono text-[11px]">
						{selectedFile ? (
							<textarea
								value={editContent}
								onChange={(e) => setEditContent(e.target.value)}
								className="h-full w-full resize-none bg-transparent font-medium text-zinc-800 focus:outline-none dark:text-zinc-200"
								placeholder="Edit file..."
							/>
						) : (
							<div className="flex h-full items-center justify-center font-medium text-zinc-500 dark:text-zinc-400">
								Select a file to edit
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Tip */}
			<div className="flex items-center gap-2 rounded-md border border-blue-300 bg-blue-50 px-3 py-2 font-medium text-[11px] dark:border-blue-600 dark:bg-blue-900/30">
				<div className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
				<span className="text-blue-800 dark:text-blue-300">
					Open in multiple tabs to see cross-tab sync via BroadcastChannel
				</span>
			</div>
		</div>
	);
};

export default OpfsDemo;
