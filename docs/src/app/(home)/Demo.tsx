"use client";

import React, { type JSX } from "react";
import { useFsStore } from "./FsStore";

/** Long files are for reading, not for scrolling forever. */
const MAX_LINES = 2000;

const Pane = ({
	label,
	subject,
	trailing,
	children,
	className = "",
}: {
	label: string;
	/** A path, shown as written — never upper-cased like the label. */
	subject?: string;
	trailing?: React.ReactNode;
	children: React.ReactNode;
	className?: string;
}) => (
	<section className={`flex min-w-0 flex-col bg-panel ${className}`}>
		<header className="flex min-h-[41px] items-center gap-3 border-line border-b px-3 py-2">
			<span className="u-eyebrow shrink-0">{label}</span>
			{subject && (
				<span
					className="min-w-0 flex-1 truncate text-[12px] text-text"
					title={subject}
				>
					{subject}
				</span>
			)}
			<div className={`flex items-center gap-2 ${subject ? "" : "ml-auto"}`}>
				{trailing}
			</div>
		</header>
		{children}
	</section>
);

const Empty = ({ headline, hint }: { headline: string; hint: string }) => (
	<div className="flex min-h-[13rem] flex-1 flex-col items-start justify-center gap-1.5 p-6">
		<p className="text-[13px] text-dim">{headline}</p>
		<p className="max-w-[36ch] text-[11.5px] text-faint leading-relaxed">
			{hint}
		</p>
	</div>
);

const buttonBase =
	"inline-flex items-center gap-1.5 rounded-[2px] border px-2.5 py-1.5 text-[11.5px] transition-colors disabled:cursor-not-allowed disabled:opacity-40";

const codeLine = (
	key: string,
	mark: " " | "+" | "-",
	text: string,
	tone: string,
	bed?: string,
) => (
	<div key={key} className={`flex whitespace-pre ${bed ?? ""}`}>
		<span
			aria-hidden="true"
			className={`w-6 shrink-0 select-none pl-2 ${tone}`}
		>
			{mark}
		</span>
		<span className={tone}>{text}</span>
	</div>
);

/** Line by line, which is all a change log needs to be readable. */
const renderDiff = (oldContent: string, newContent: string) => {
	const oldLines = oldContent.split("\n");
	const newLines = newContent.split("\n");
	const diff: JSX.Element[] = [];

	let i = 0;
	let j = 0;
	while (
		(i < oldLines.length || j < newLines.length) &&
		diff.length < MAX_LINES
	) {
		if (
			i < oldLines.length &&
			j < newLines.length &&
			oldLines[i] === newLines[j]
		) {
			diff.push(codeLine(`ctx-${i}-${j}`, " ", oldLines[i], "text-faint"));
			i++;
			j++;
		} else {
			if (i < oldLines.length) {
				diff.push(
					codeLine(`old-${i}`, "-", oldLines[i], "text-del", "bg-del-bed"),
				);
				i++;
			}
			if (j < newLines.length) {
				diff.push(
					codeLine(`new-${j}`, "+", newLines[j], "text-add", "bg-add-bed"),
				);
				j++;
			}
		}
	}

	return diff;
};

const App = () => {
	const {
		files,
		directories,
		events,
		clearEvents,
		selection,
		selectFile,
		applyWrite,
		open,
		isOpening,
		openOpfs,
		isOpeningOpfs,
		isOpfs,
		reset,
		mountError,
		isBrowserSupported,
		isOpfsSupported,
		isProcessing,
		isPolling,
		error,
		writeFile,
		startPolling,
		stopPolling,
	} = useFsStore();

	const busy = isOpening || isOpeningOpfs;
	const [isEditing, setIsEditing] = React.useState(false);
	const [draft, setDraft] = React.useState("");
	const [isDirty, setIsDirty] = React.useState(false);
	const [confirmDiscard, setConfirmDiscard] = React.useState(false);
	const [saveError, setSaveError] = React.useState<string | null>(null);

	const paths = Array.from(files.keys());
	const root = directories[0] ?? "";
	const isDiff = selection.previousContent !== null;

	// The root is named once in the toolbar, so rows show the path below it.
	const relative = (path: string) =>
		root && path.startsWith(`${root}/`) ? path.slice(root.length + 1) : path;

	const handleSelect = (path: string) => {
		selectFile(path);
		setIsEditing(false);
		setDraft(files.get(path) ?? "");
		setIsDirty(false);
		setConfirmDiscard(false);
		setSaveError(null);
	};

	const leaveEditing = () => {
		setIsEditing(false);
		setIsDirty(false);
		setConfirmDiscard(false);
		setSaveError(null);
	};

	const handleSave = async () => {
		if (!selection.path) {
			return;
		}
		try {
			if (!files.has(selection.path)) {
				throw new Error("That file is no longer in the watched directory.");
			}
			await writeFile(selection.path, draft);
			applyWrite(draft);
			setIsDirty(false);
			setSaveError(null);
		} catch (err: unknown) {
			setSaveError(
				err instanceof Error ? err.message : "The write did not go through.",
			);
		}
	};

	return (
		// biome-ignore lint/correctness/useUniqueElementIds: a stable anchor target for the links above it
		<section
			id="playground"
			className="u-shell scroll-mt-16 border-line border-b py-16 lg:py-20"
		>
			<div className="flex flex-wrap items-end justify-between gap-4">
				<div>
					<p className="u-eyebrow">Full view</p>
					<h2 className="u-h2 mt-4 max-w-[24ch]">
						Read it, edit it, write it back.
					</h2>
				</div>
				<p className="max-w-[38ch] text-[12px] text-faint leading-relaxed">
					The same directory the panel at the top is watching — a folder off
					your disk, or the browser's own storage. Everything runs in this tab;
					nothing is uploaded, and disk access ends when you close it.
				</p>
			</div>

			{!(isBrowserSupported || isOpfsSupported) && (
				<p className="mt-8 border border-del/40 bg-del-bed px-4 py-3 text-[12.5px] text-del">
					This browser has neither the File System Access API nor the origin
					private file system. Open the page in a current Chrome, Edge, Opera,
					Safari or Firefox to use the playground.
				</p>
			)}

			{!isBrowserSupported && isOpfsSupported && (
				<p className="mt-8 border border-line bg-panel px-4 py-3 text-[12.5px] text-dim">
					No directory picker in this browser — that part needs desktop Chrome,
					Edge or Opera. <span className="text-text">Use browser storage</span>{" "}
					instead: it is the same hook against the origin private file system,
					and everything below works.
				</p>
			)}

			{(mountError ?? error) && (
				<p className="mt-8 border border-chg/40 bg-chg-bed px-4 py-3 text-[12.5px] text-chg">
					{(mountError ?? error)?.message}
				</p>
			)}

			<div className="mt-8 border border-line">
				{/* Toolbar */}
				<div className="flex flex-wrap items-center gap-2 border-line border-b bg-raised px-3 py-2.5">
					<button
						type="button"
						onClick={open}
						disabled={busy || !isBrowserSupported}
						className={`${buttonBase} border-line-strong bg-text text-ground hover:opacity-85`}
					>
						{isOpening
							? "Opening…"
							: root
								? "Open another folder"
								: "Open a folder"}
					</button>
					<button
						type="button"
						onClick={openOpfs}
						disabled={busy || !isOpfsSupported}
						className={`${buttonBase} border-line-strong text-text hover:bg-inset`}
					>
						{isOpeningOpfs ? "Mounting…" : "Use browser storage"}
					</button>
					<button
						type="button"
						onClick={() => {
							reset();
							leaveEditing();
						}}
						disabled={directories.length === 0}
						className={`${buttonBase} border-line text-dim hover:border-line-strong hover:text-text`}
					>
						Close
					</button>
					<button
						type="button"
						onClick={isPolling ? stopPolling : startPolling}
						disabled={directories.length === 0}
						className={`${buttonBase} ${
							isPolling
								? "border-chg/40 text-chg hover:bg-chg-bed"
								: "border-add/40 text-add hover:bg-add-bed"
						}`}
					>
						{isPolling ? "Pause watching" : "Resume watching"}
					</button>

					<div className="ml-auto flex items-center gap-4">
						{isProcessing && (
							<span className="u-eyebrow text-chg">scanning</span>
						)}
						{root && (
							<span className="flex min-w-0 items-center gap-2">
								{isOpfs && (
									<span className="u-eyebrow shrink-0 border border-line px-1 text-[9px] text-add">
										opfs
									</span>
								)}
								<span
									className="max-w-[16rem] truncate text-[12px] text-dim"
									title={root}
								>
									{root}
								</span>
							</span>
						)}
						<span className="u-eyebrow">
							<span className="text-dim tabular-nums">{files.size}</span> files
						</span>
						<span className="flex items-center gap-2">
							<span
								className={`inline-block h-1.5 w-1.5 rounded-full ${
									isPolling ? "u-tick bg-add" : "bg-faint"
								}`}
							/>
							<span
								className={`u-eyebrow ${isPolling ? "text-add" : "text-faint"}`}
							>
								{isPolling ? "watching" : "paused"}
							</span>
						</span>
					</div>
				</div>

				{/* Files · viewer · events */}
				<div className="grid divide-line lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] lg:divide-x xl:grid-cols-[minmax(0,16rem)_minmax(0,1fr)_minmax(0,17rem)]">
					<Pane
						label="Files"
						className="max-lg:border-line max-lg:border-b"
						trailing={
							paths.length > 0 ? (
								<span className="text-[11px] text-faint tabular-nums">
									{paths.length}
								</span>
							) : undefined
						}
					>
						{paths.length === 0 ? (
							<Empty
								headline={
									directories.length > 0
										? "This directory is empty."
										: "Nothing open yet."
								}
								hint={
									directories.length > 0
										? "Write a file to it and the watcher picks it up on the next scan. commonFilters hides node_modules, build output and anything your .gitignore lists."
										: "Pick a folder, or mount browser storage — nothing is read until you do. commonFilters skips node_modules, build output and anything your .gitignore lists."
								}
							/>
						) : (
							<div className="u-scroll h-[26rem] overflow-y-auto py-1">
								{paths.map((path) => {
									const shown = relative(path);
									const cut = shown.lastIndexOf("/");
									const dir = cut === -1 ? "" : shown.slice(0, cut + 1);
									const name = cut === -1 ? shown : shown.slice(cut + 1);
									const active = selection.path === path;
									return (
										<button
											type="button"
											key={path}
											onClick={() => handleSelect(path)}
											className={`block w-full truncate px-3 py-[5px] text-left text-[12px] transition-colors ${
												active
													? "bg-inset text-text"
													: "text-dim hover:bg-inset/60 hover:text-text"
											}`}
											title={path}
										>
											<span className="text-faint">{dir}</span>
											{name}
										</button>
									);
								})}
							</div>
						)}
					</Pane>

					<Pane
						label="Viewer"
						subject={selection.path ? relative(selection.path) : undefined}
						trailing={
							selection.path ? (
								<div className="flex shrink-0 items-center gap-1.5">
									{!isEditing && (
										<span className="u-eyebrow">
											{isDiff ? "diff" : "contents"}
										</span>
									)}
									{isEditing ? (
										<>
											<button
												type="button"
												onClick={handleSave}
												disabled={!isDirty}
												className={`${buttonBase} border-add/40 text-add hover:bg-add-bed`}
											>
												Save to disk
											</button>
											<button
												type="button"
												onClick={() => {
													if (isDirty && !confirmDiscard) {
														setConfirmDiscard(true);
														return;
													}
													leaveEditing();
												}}
												className={`${buttonBase} ${
													confirmDiscard
														? "border-del/40 text-del hover:bg-del-bed"
														: "border-line text-dim hover:border-line-strong hover:text-text"
												}`}
											>
												{confirmDiscard ? "Discard changes?" : "Cancel"}
											</button>
										</>
									) : (
										<button
											type="button"
											onClick={() => {
												setIsEditing(true);
												setDraft(selection.content ?? "");
												setIsDirty(false);
											}}
											className={`${buttonBase} border-line text-dim hover:border-line-strong hover:text-text`}
										>
											Edit
										</button>
									)}
								</div>
							) : undefined
						}
					>
						{saveError && (
							<p className="border-line border-b bg-del-bed px-3 py-2 text-[11.5px] text-del">
								{saveError}
							</p>
						)}
						{selection.path ? (
							<div className="h-[26rem]">
								{isEditing ? (
									<textarea
										value={draft}
										onChange={(e) => {
											setDraft(e.target.value);
											setIsDirty(e.target.value !== selection.content);
											setConfirmDiscard(false);
										}}
										spellCheck={false}
										className="u-scroll h-full w-full resize-none bg-ground p-3 font-mono text-[12.5px] text-text leading-[1.7] outline-none"
										placeholder="Type, then save to write it to disk."
									/>
								) : (
									<div className="u-scroll h-full overflow-auto py-2 font-mono text-[12.5px] leading-[1.7]">
										{isDiff
											? renderDiff(
													selection.previousContent ?? "",
													selection.content ?? "",
												)
											: (selection.content ?? "")
													.split("\n")
													.slice(0, MAX_LINES)
													.map((text, i) =>
														codeLine(`c-${i}`, " ", text, "text-dim"),
													)}
									</div>
								)}
							</div>
						) : (
							<Empty
								headline="No file selected."
								hint="Pick one on the left to read it. Change it in your editor and the diff appears here on the next scan."
							/>
						)}
					</Pane>

					<Pane
						label="Events"
						className="max-xl:border-line max-xl:border-t lg:col-span-2 xl:col-span-1"
						trailing={
							events.length > 0 ? (
								<button
									type="button"
									onClick={clearEvents}
									className="u-eyebrow hover:text-text"
								>
									clear
								</button>
							) : undefined
						}
					>
						{events.length === 0 ? (
							<Empty
								headline="Nothing yet."
								hint="Added and deleted files land here, newest first, as each scan resolves."
							/>
						) : (
							<div className="u-scroll max-h-[26rem] overflow-y-auto py-1 xl:h-[26rem]">
								{events.map((entry) => (
									<div
										key={entry.id}
										className="flex items-baseline gap-2 px-3 py-[5px] text-[12px]"
									>
										<span
											aria-hidden="true"
											className={`w-2 shrink-0 font-bold ${
												entry.kind === "added" ? "text-add" : "text-del"
											}`}
										>
											{entry.kind === "added" ? "+" : "-"}
										</span>
										<span className="truncate text-dim" title={entry.path}>
											{relative(entry.path)}
										</span>
										<span className="ml-auto shrink-0 text-[11px] text-faint tabular-nums">
											{new Date(entry.timestamp).toLocaleTimeString(undefined, {
												hour12: false,
											})}
										</span>
									</div>
								))}
							</div>
						)}
					</Pane>
				</div>
			</div>
		</section>
	);
};

export default App;
