"use client";

import React from "react";
import { useFsStore } from "./FsStore";
import { BED, GLYPH, type Signal, TONE } from "./signals";

/**
 * The hero's instrument, and the page's first working control.
 *
 * With no directory open it runs a scripted preview at the library's real
 * default `pollInterval` of 300ms, so the shape of the thing is legible before
 * anyone clicks. The moment a folder is opened it switches to that folder —
 * the same watcher the playground further down the page is reading.
 */

const POLL_MS = 300;
const TREE_ROWS = 10;
const LOG_ROWS = 6;

interface Row {
	path: string;
	label: string;
	depth: number;
	dir?: boolean;
	/** Pruned by `commonFilters` — shown so the filter behaviour is visible. */
	pruned?: boolean;
	/** Absent until an `added` step puts it there. */
	transient?: boolean;
}

const SAMPLE: Row[] = [
	{ path: "my-project", label: "my-project/", depth: 0, dir: true },
	{ path: "my-project/src", label: "src/", depth: 1, dir: true },
	{ path: "my-project/src/index.ts", label: "index.ts", depth: 2 },
	{ path: "my-project/src/scan.ts", label: "scan.ts", depth: 2 },
	{ path: "my-project/src/walk.ts", label: "walk.ts", depth: 2 },
	{
		path: "my-project/src/types.ts",
		label: "types.ts",
		depth: 2,
		transient: true,
	},
	{ path: "my-project/README.md", label: "README.md", depth: 1 },
	{ path: "my-project/.env.local", label: ".env.local", depth: 1 },
	{
		path: "my-project/node_modules",
		label: "node_modules/",
		depth: 1,
		dir: true,
		pruned: true,
	},
];

interface Step {
	kind: Signal;
	path: string;
	/** Scans since the previous step, so the clock reads like a real log. */
	scans: number;
}

const SCRIPT: Step[] = [
	{ kind: "changed", path: "my-project/src/walk.ts", scans: 5 },
	{ kind: "added", path: "my-project/src/types.ts", scans: 4 },
	{ kind: "changed", path: "my-project/src/index.ts", scans: 6 },
	{ kind: "deleted", path: "my-project/.env.local", scans: 5 },
	{ kind: "changed", path: "my-project/README.md", scans: 7 },
	{ kind: "added", path: "my-project/.env.local", scans: 4 },
	{ kind: "changed", path: "my-project/src/scan.ts", scans: 5 },
	{ kind: "deleted", path: "my-project/src/types.ts", scans: 6 },
];

interface LogLine {
	id: string;
	kind: Signal;
	path: string;
	at: string;
}

/** mm:ss.cs, the way a scan log would actually stamp it. */
const stamp = (scans: number) => {
	const ms = scans * POLL_MS;
	const minutes = Math.floor(ms / 60_000);
	const seconds = (ms % 60_000) / 1000;
	return `${String(minutes).padStart(2, "0")}:${seconds.toFixed(2).padStart(5, "0")}`;
};

/** Which transient sample rows exist after `n` scripted steps. */
const presentAfter = (n: number) => {
	const present = new Set(
		SAMPLE.filter((r) => !r.transient).map((r) => r.path),
	);
	for (let i = 0; i < n; i++) {
		const step = SCRIPT[i % SCRIPT.length];
		if (step.kind === "added") {
			present.add(step.path);
		}
		if (step.kind === "deleted") {
			present.delete(step.path);
		}
	}
	return present;
};

/** Drives the scripted preview. Idle once a real directory is open. */
const usePreview = (enabled: boolean) => {
	const [step, setStep] = React.useState(0);
	const [scans, setScans] = React.useState(0);
	const [log, setLog] = React.useState<LogLine[]>([]);
	const [animated, setAnimated] = React.useState(false);

	React.useEffect(() => {
		if (!enabled) {
			return;
		}
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
			// A settled state instead of a loop: same information, holding still.
			setScans(142);
			setStep(3);
			setLog(
				SCRIPT.slice(0, 3)
					.map((s, i) => ({
						id: `preview-${i}`,
						kind: s.kind,
						path: s.path,
						at: stamp(120 + i * 5),
					}))
					.reverse(),
			);
			return;
		}

		setAnimated(true);
		let scan = 0;
		let index = 0;
		let nextAt = SCRIPT[0].scans;

		const id = window.setInterval(() => {
			scan += 1;
			setScans(scan);
			if (scan < nextAt) {
				return;
			}
			const current = SCRIPT[index % SCRIPT.length];
			setLog((prev) =>
				[
					{
						id: `preview-${index}`,
						kind: current.kind,
						path: current.path,
						at: stamp(scan),
					},
					...prev,
				].slice(0, LOG_ROWS),
			);
			index += 1;
			setStep(index);
			nextAt = scan + SCRIPT[index % SCRIPT.length].scans;
		}, POLL_MS);

		return () => window.clearInterval(id);
	}, [enabled]);

	return { step, scans, log, animated };
};

const controlBase =
	"inline-flex items-center rounded-[2px] border px-2.5 py-1 text-[11px] transition-colors disabled:cursor-not-allowed disabled:opacity-40";

/** One row height everywhere, so neither column jumps as events land. */
const ROW = "h-[22px]";

export const LivePanel = () => {
	const {
		files,
		directories,
		events,
		isPolling,
		isProcessing,
		isBrowserSupported,
		reset,
		startPolling,
		stopPolling,
	} = useFsStore();

	const isReal = directories.length > 0;
	const preview = usePreview(!isReal);

	const paths = React.useMemo(() => Array.from(files.keys()), [files]);
	const root = directories[0] ?? "my-project";

	// Sample rows, or the head of the real tree.
	const rows: Row[] = isReal
		? paths.slice(0, TREE_ROWS).map((path) => {
				const rest = path.startsWith(`${root}/`)
					? path.slice(root.length + 1)
					: path;
				const depth = rest.split("/").length;
				return {
					path,
					label: rest.split("/").pop() ?? rest,
					depth: Math.min(depth, 3),
				};
			})
		: SAMPLE.filter(
				(r) => !r.transient || presentAfter(preview.step).has(r.path),
			).slice(0, TREE_ROWS);

	const log: LogLine[] = isReal
		? events.slice(0, LOG_ROWS).map((event) => ({
				id: event.id,
				kind: event.kind,
				path: event.path,
				at: new Date(event.timestamp).toLocaleTimeString(undefined, {
					hour12: false,
				}),
			}))
		: preview.log;

	const marked = log[0];
	const overflow = isReal ? Math.max(0, paths.length - TREE_ROWS) : 0;
	const fileCount = isReal ? files.size : rows.filter((r) => !r.dir).length;
	const scanning = isReal ? isProcessing : preview.animated;
	const watching = isReal ? isPolling : true;

	return (
		<div className="flex flex-col overflow-hidden border border-line bg-panel">
			{/* Readout and controls. The panel is the page's first working button. */}
			<div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-line border-b bg-raised px-3 py-2.5">
				<span className="flex items-center gap-2">
					<span
						className={`inline-block h-1.5 w-1.5 rounded-full ${
							watching ? "bg-add" : "bg-faint"
						} ${scanning ? "u-tick" : ""}`}
					/>
					<span className={`u-eyebrow ${watching ? "text-add" : "text-faint"}`}>
						{watching ? "watching" : "paused"}
					</span>
				</span>

				{isReal ? (
					<span className="u-eyebrow">
						<span className="text-dim tabular-nums">{fileCount}</span> files ·{" "}
						<span className="text-dim">300ms</span>
					</span>
				) : (
					<span className="u-eyebrow">
						scan{" "}
						<span className="text-dim tabular-nums">
							{String(preview.scans).padStart(4, "0")}
						</span>{" "}
						· <span className="text-dim">300ms</span>
					</span>
				)}

				{isReal && (
					<span className="ml-auto flex items-center gap-1.5">
						<button
							type="button"
							onClick={isPolling ? stopPolling : startPolling}
							className={`${controlBase} ${
								isPolling
									? "border-chg/40 text-chg hover:bg-chg-bed"
									: "border-add/40 text-add hover:bg-add-bed"
							}`}
						>
							{isPolling ? "Pause" : "Resume"}
						</button>
						<button
							type="button"
							onClick={reset}
							className={`${controlBase} border-line text-dim hover:border-line-strong hover:text-text`}
						>
							Close
						</button>
					</span>
				)}
			</div>

			<div className="grid flex-1 sm:grid-cols-[1.05fr_1fr]">
				{/* Tree */}
				<div className="relative overflow-hidden py-2 sm:border-line sm:border-r">
					{preview.animated && !isReal && (
						<div
							aria-hidden="true"
							className="u-sweep pointer-events-none absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-transparent via-chg-bed to-transparent"
						/>
					)}
					{isReal && (
						<div
							className={`${ROW} flex items-center px-3 text-[12.5px] text-text`}
						>
							{root}/
						</div>
					)}
					{rows.map((row) => {
						const hit = marked?.path === row.path;
						const kind = hit ? marked.kind : null;
						return (
							<div
								key={row.path}
								className={`${ROW} flex items-center gap-2 px-3 text-[12.5px] ${
									row.pruned ? "text-faint" : "text-dim"
								}`}
							>
								<span
									aria-hidden="true"
									className="shrink-0 select-none text-faint"
									style={{ paddingLeft: `${row.depth * 0.8}rem` }}
								>
									{row.depth === 0 ? "" : "└─"}
								</span>
								<span
									className={`truncate ${row.dir && !row.pruned ? "text-text" : ""}`}
								>
									{row.label}
								</span>
								{row.pruned && (
									<span className="u-eyebrow shrink-0 border border-line px-1 text-[9px]">
										pruned
									</span>
								)}
								{kind && (
									<span
										className={`u-land ml-auto shrink-0 px-1.5 font-bold ${TONE[kind]} ${BED[kind]}`}
									>
										{GLYPH[kind]}
									</span>
								)}
							</div>
						);
					})}
					{overflow > 0 && (
						<a
							href="#playground"
							className={`${ROW} flex items-center px-3 text-[11.5px] text-faint hover:text-text`}
						>
							+{overflow} more in the playground ↓
						</a>
					)}
				</div>

				{/* Event stream. Fixed slots, so nothing reflows as lines land. */}
				<div className="flex flex-col border-line border-t sm:border-t-0">
					<div className="border-line border-b px-3 py-2">
						<span className="u-eyebrow">
							{isReal ? "callbacks fired" : "callbacks · preview"}
						</span>
					</div>
					<div className="flex-1 py-2">
						{Array.from({ length: LOG_ROWS }, (_, i) => {
							const entry = log[i];
							if (!entry) {
								return (
									<div
										// biome-ignore lint/suspicious/noArrayIndexKey: an empty slot has no identity but its position
										key={`slot-${i}`}
										aria-hidden="true"
										className={`${ROW} flex items-center px-3 text-[12.5px] text-faint/40`}
									>
										·
									</div>
								);
							}
							return (
								<div
									key={entry.id}
									className={`${ROW} u-land flex items-baseline gap-2 px-3 text-[12.5px]`}
									style={{ opacity: 1 - i * 0.13 }}
								>
									<span
										className={`w-2 shrink-0 font-bold ${TONE[entry.kind]}`}
									>
										{GLYPH[entry.kind]}
									</span>
									<span className="truncate text-dim" title={entry.path}>
										{entry.path.replace(`${root}/`, "")}
									</span>
									<span className="ml-auto shrink-0 text-[11px] text-faint tabular-nums">
										{entry.at}
									</span>
								</div>
							);
						})}
					</div>
				</div>
			</div>

			{/* Footer states the mode, so the preview is never mistaken for real. */}
			<div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-line border-t bg-raised px-3 py-2">
				{isReal ? (
					<>
						<span className="u-eyebrow text-add">live</span>
						<span className="min-w-0 flex-1 truncate text-[11.5px] text-faint">
							Edit a file in {root} and watch it land here.
						</span>
						<a
							href="#playground"
							className="u-eyebrow shrink-0 text-dim hover:text-text"
						>
							full view ↓
						</a>
					</>
				) : (
					<>
						<span className="u-eyebrow text-chg">preview</span>
						<span className="text-[11.5px] text-faint">
							{isBrowserSupported
								? "Open a folder to watch your own."
								: "Needs desktop Chrome, Edge or Opera."}
						</span>
					</>
				)}
			</div>
		</div>
	);
};
