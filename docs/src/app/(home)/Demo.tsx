"use client";

import React from "react";
import FsaDemo from "./FsaDemo";
import OpfsDemo from "./OpfsDemo";

type Tab = "fsa" | "opfs";
type PM = "npm" | "pnpm" | "yarn" | "bun";

const pmCommands: Record<PM, { cmd: string; args: string }> = {
	npm: { cmd: "npm", args: "install use-fs" },
	pnpm: { cmd: "pnpm", args: "add use-fs" },
	yarn: { cmd: "yarn", args: "add use-fs" },
	bun: { cmd: "bun", args: "add use-fs" },
};

const App = () => {
	const [activeTab, setActiveTab] = React.useState<Tab>("fsa");
	const [pm, setPm] = React.useState<PM>("npm");
	const [copied, setCopied] = React.useState(false);

	const copyCommand = () => {
		const { cmd, args } = pmCommands[pm];
		navigator.clipboard.writeText(`${cmd} ${args}`);
		setCopied(true);
		setTimeout(() => setCopied(false), 1500);
	};

	return (
		<main className="mx-auto max-w-7xl px-4 py-3 font-mono text-sm sm:py-4">
			<div className="space-y-3">
				{/* Hero */}
				<div className="text-center">
					<h1 className="font-bold text-2xl text-zinc-900 dark:text-zinc-100">
						use-fs
					</h1>
					<p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
						React hooks for browser file system APIs
					</p>
				</div>

				{/* Tab Navigation */}
				<div className="rounded-md border border-zinc-200 bg-zinc-100 p-0.5 dark:border-zinc-700 dark:bg-zinc-800">
					<div className="flex">
						<button
							type="button"
							onClick={() => setActiveTab("fsa")}
							className={`flex-1 rounded px-3 py-1.5 font-medium text-xs transition-colors ${
								activeTab === "fsa"
									? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-100"
									: "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
							}`}
						>
							<span className="flex items-center justify-center gap-1.5">
								<svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<title>Folder icon</title>
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
								</svg>
								File System Access
							</span>
						</button>
						<button
							type="button"
							onClick={() => setActiveTab("opfs")}
							className={`flex-1 rounded px-3 py-1.5 font-medium text-xs transition-colors ${
								activeTab === "opfs"
									? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-100"
									: "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
							}`}
						>
							<span className="flex items-center justify-center gap-1.5">
								<svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<title>Database icon</title>
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
								</svg>
								OPFS
							</span>
						</button>
					</div>
				</div>

				{/* Install Command */}
				<div className="overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-700">
					<div className="flex items-center gap-1 border-b border-zinc-200 bg-zinc-100 px-1 py-0.5 dark:border-zinc-700 dark:bg-zinc-800">
						{(["npm", "pnpm", "yarn", "bun"] as PM[]).map((p) => (
							<button
								key={p}
								type="button"
								onClick={() => setPm(p)}
								className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
									pm === p
										? "bg-white text-zinc-900 dark:bg-zinc-900 dark:text-white"
										: "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
								}`}
							>
								{p}
							</button>
						))}
					</div>
					<div className="flex items-center justify-between bg-zinc-50 px-3 py-2 dark:bg-zinc-900">
						<code className="text-[11px] font-medium text-zinc-800 dark:text-zinc-200">
							<span className="text-zinc-500 dark:text-zinc-400">$</span>{" "}
							{pmCommands[pm].cmd} {pmCommands[pm].args}
						</code>
						<button
							type="button"
							onClick={copyCommand}
							className="rounded p-1 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-white"
						>
							{copied ? (
								<svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<title>Copied</title>
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
								</svg>
							) : (
								<svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<title>Copy</title>
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
								</svg>
							)}
						</button>
					</div>
				</div>

				{/* Tab Content */}
				<div>{activeTab === "fsa" ? <FsaDemo /> : <OpfsDemo />}</div>

				{/* Footer */}
				<div className="pt-2 text-center text-[10px] text-zinc-400">
					Built by{" "}
					<a
						href="https://linesofcode.dev"
						target="_blank"
						rel="noopener noreferrer"
						className="text-emerald-500 transition-colors hover:text-emerald-400"
					>
						linesofcode.dev
					</a>
				</div>
			</div>
		</main>
	);
};

export default App;
