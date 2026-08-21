"use client";

import { Code } from "./Code";
import { useFsStore } from "./FsStore";

/**
 * The two backing stores, presented as equals.
 *
 * Both hand the hook a `FileSystemDirectoryHandle`, so everything downstream —
 * filters, scanning, writes — is identical. What differs is who owns the bytes
 * and what the browser asks the user first.
 */

const PICKER_SNIPPET = `
const { onDirectorySelection, files } = useFs();

// The picker only opens from a user gesture,
// so this belongs in an event handler.
return (
  <button onClick={() => onDirectorySelection()}>
    Open a folder
  </button>
);
`;

const OPFS_SNIPPET = `
const { addOpfsDirectory, files } = useFs();

useEffect(() => {
  // No picker, no prompt, no gesture.
  // Mounts <opfs>/notes and watches it.
  addOpfsDirectory({ name: "notes" });
}, [addOpfsDirectory]);
`;

const FACTS = {
	picker: [
		["Browsers", "Desktop Chrome, Edge, Opera"],
		["Asks", "A picker, then a permission prompt to write"],
		["Stored", "On your disk, where your editor can see them"],
	],
	opfs: [
		["Browsers", "Chrome, Edge, Opera, Safari 17+, Firefox 111+"],
		["Asks", "Nothing at all"],
		["Stored", "In the browser, private to this origin"],
	],
};

const Facts = ({ rows }: { rows: string[][] }) => (
	<dl className="mt-6">
		{rows.map(([label, value]) => (
			<div
				key={label}
				className="flex flex-wrap items-baseline gap-x-3 border-line-soft border-b py-2.5 last:border-b-0"
			>
				<dt className="u-eyebrow w-[6.5rem] shrink-0">{label}</dt>
				<dd className="min-w-0 flex-1 text-[12.5px] text-dim">{value}</dd>
			</div>
		))}
	</dl>
);

const buttonBase =
	"mt-6 inline-flex items-center border px-3.5 py-2 text-[12px] transition-colors disabled:cursor-not-allowed disabled:opacity-40";

export const Stores = () => {
	const {
		open,
		isOpening,
		openOpfs,
		isOpeningOpfs,
		isBrowserSupported,
		isOpfsSupported,
	} = useFsStore();
	const busy = isOpening || isOpeningOpfs;

	return (
		<section className="u-shell border-line border-b py-16 lg:py-20">
			<div className="flex flex-wrap items-end justify-between gap-4">
				<div>
					<p className="u-eyebrow">Two stores, one hook</p>
					<h2 className="u-h2 mt-4 max-w-[26ch]">
						A folder on disk, or the browser's own.
					</h2>
				</div>
				<p className="max-w-[40ch] text-[12px] text-faint leading-relaxed">
					Both are a FileSystemDirectoryHandle underneath, so the same{" "}
					<span className="text-dim">files</span> map, the same filters and the
					same <span className="text-dim">writeFile</span> work against either.
					Watch one, the other, or both at once.
				</p>
			</div>

			<div className="mt-10 grid gap-10 lg:grid-cols-2 lg:gap-0">
				<div className="min-w-0 lg:pr-10">
					<div className="flex items-baseline gap-3">
						<span aria-hidden="true" className="u-eyebrow text-chg">
							01
						</span>
						<h3 className="font-display font-semibold text-[15px] text-text tracking-[-0.02em]">
							A folder on disk
						</h3>
					</div>
					<p className="mt-3 max-w-[46ch] text-[13px] text-dim leading-relaxed lg:min-h-[5.5rem]">
						The user picks a directory and grants access to it. Your app reads
						and writes the real files — the ones already open in their editor.
					</p>
					<Code className="mt-6" filename="picker.tsx" code={PICKER_SNIPPET} />
					<Facts rows={FACTS.picker} />
					<button
						type="button"
						onClick={open}
						disabled={busy || !isBrowserSupported}
						className={`${buttonBase} border-line-strong bg-text text-ground hover:opacity-85`}
					>
						{isOpening ? "Opening…" : "Open a folder"}
					</button>
					{!isBrowserSupported && (
						<p className="mt-3 text-[11.5px] text-faint">
							This browser has no directory picker. The store on the right works
							here.
						</p>
					)}
				</div>

				<div className="min-w-0 border-line border-t pt-10 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-10">
					<div className="flex items-baseline gap-3">
						<span aria-hidden="true" className="u-eyebrow text-add">
							02
						</span>
						<h3 className="font-display font-semibold text-[15px] text-text tracking-[-0.02em]">
							Browser storage
						</h3>
					</div>
					<p className="mt-3 max-w-[46ch] text-[13px] text-dim leading-relaxed lg:min-h-[5.5rem]">
						The origin private file system: a real directory tree the user never
						sees, scoped to your origin and kept across reloads. Nothing to
						approve, so it can mount in an effect.
					</p>
					<Code className="mt-6" filename="storage.tsx" code={OPFS_SNIPPET} />
					<Facts rows={FACTS.opfs} />
					<button
						type="button"
						onClick={openOpfs}
						disabled={busy || !isOpfsSupported}
						className={`${buttonBase} border-line-strong text-text hover:bg-inset`}
					>
						{isOpeningOpfs ? "Mounting…" : "Use browser storage"}
					</button>
					<p className="mt-3 max-w-[46ch] text-[11.5px] text-faint leading-relaxed">
						Pass <span className="text-dim">name</span>. The OPFS root is shared
						with everything else on the origin — WASM databases, other libraries
						— and mounting it whole means walking all of it on every scan.
					</p>
				</div>
			</div>
		</section>
	);
};
