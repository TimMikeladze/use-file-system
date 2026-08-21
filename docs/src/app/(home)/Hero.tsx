"use client";

import { InstallCommand } from "react-install-command";
import "react-install-command/styles.css";
import { useFsStore } from "./FsStore";
import { LivePanel } from "./LivePanel";

const installSlots = {
	root: "!bg-panel !border !border-line !rounded-none !overflow-hidden",
	navigation:
		"!bg-raised !border-b !border-line !px-1 !py-0.5 !flex !flex-row !flex-wrap !items-center !min-h-fit !gap-0",
	tab: "!px-2 !py-1 !text-[11px] !rounded-[2px] !text-faint hover:!text-text data-[selected=true]:!bg-inset data-[selected=true]:!text-text !whitespace-nowrap !font-mono",
	tabIcon: "!w-3.5 !h-3.5 !mr-1.5",
	tabText: "!text-inherit",
	tabIndicator: "!hidden",
	commandContainer:
		"!bg-panel !px-3 !py-2.5 !flex !items-center !gap-2 !border-0 !font-mono",
	commandGroup: "!flex !items-center !gap-2",
	commandPrefix: "!text-chg !shrink-0 !text-[13px]",
	commandText: "!text-dim !text-[13px]",
	commandTextCommand: "!text-text !text-[13px]",
	copyButton:
		"!ml-auto !p-1.5 !rounded-[2px] !text-faint hover:!text-text hover:!bg-inset !shrink-0",
	copyButtonIcon: "!w-4 !h-4",
};

/** Four facts a developer decides on before reading any further. */
const SPECS = [
	["Runs in", "Chrome · Edge · Opera, desktop"],
	["Talks to", "Nothing. No server, no upload"],
	["Access", "Read by default, write on request"],
	["Licence", "MIT · zero dependencies"],
];

/** The page's one primary action. The panel beside it shows the result. */
const HeroOpenButton = () => {
	const { open, isOpening, isBrowserSupported, directories } = useFsStore();
	const label =
		directories.length > 0 ? "Open another folder" : "Open a folder";
	return (
		<button
			type="button"
			onClick={open}
			disabled={isOpening || !isBrowserSupported}
			className="border border-line-strong bg-text px-4 py-2.5 text-[12px] text-ground transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
		>
			{isOpening ? "Opening…" : label}
		</button>
	);
};

export const Hero = () => (
	<section>
		{/* Below `lg` the app bar has no room for the tagline, so it sits here. */}
		<div className="border-line border-b lg:hidden">
			<div className="u-shell flex flex-wrap items-center gap-x-2 gap-y-1 py-3">
				<span className="u-eyebrow">a React hook for the</span>
				<a
					href="https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API"
					target="_blank"
					rel="noopener noreferrer"
					className="u-eyebrow text-chg underline decoration-chg/30 underline-offset-4 hover:decoration-chg"
				>
					File System Access API
				</a>
			</div>
		</div>

		<div className="u-shell grid items-center gap-10 py-12 lg:grid-cols-[minmax(0,1.12fr)_minmax(0,1fr)] lg:gap-14 lg:py-16">
			<div className="flex flex-col justify-center">
				<h1 className="u-display font-semibold text-[clamp(1.4rem,3.5vw,2.3rem)]">
					Watch a folder.
					<br />
					<span className="text-chg">Re-render</span> on change.
				</h1>

				<p className="mt-6 max-w-[52ch] text-[14.5px] text-dim leading-[1.75]">
					Point <span className="text-text">useFs()</span> at a folder on your
					machine. Your component gets everything inside it, and re-renders the
					moment a file is added, changed or deleted. No upload, no refresh, no
					second file dialog.
				</p>

				<div className="u-install mt-8 max-w-[30rem]">
					<InstallCommand packageName="use-fs" slotClassNames={installSlots} />
				</div>

				<div className="mt-4 flex flex-wrap items-center gap-2.5">
					<HeroOpenButton />
					<a
						href="#playground"
						className="border border-line px-4 py-2.5 text-[12px] text-dim transition-colors hover:border-line-strong hover:text-text"
					>
						Full playground
					</a>
				</div>
			</div>

			<LivePanel />
		</div>

		{/* Bottom rail: the answers to "can I actually use this". */}
		<div className="border-line border-y bg-panel">
			<div className="u-shell grid sm:grid-cols-2 lg:grid-cols-4">
				{SPECS.map(([label, value]) => (
					<div
						key={label}
						className="border-line border-b py-4 last:border-b-0 sm:border-l sm:px-6 sm:first:border-l-0 sm:first:pl-0 lg:border-b-0 lg:last:pr-0 sm:[&:nth-child(2)]:border-b-0 lg:[&:nth-child(3)]:border-l"
					>
						<p className="u-eyebrow">{label}</p>
						<p className="mt-2 text-[12.5px] text-dim">{value}</p>
					</div>
				))}
			</div>
		</div>
	</section>
);
