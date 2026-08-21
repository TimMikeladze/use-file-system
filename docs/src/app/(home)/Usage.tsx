import { Code } from "./Code";

const SNIPPET = `
import { commonFilters, useFs } from "use-fs";

function Editor() {
  const {
    onDirectorySelection,
    files,
    writeFile,
    isBrowserSupported,
  } = useFs({
    // Prunes build output, drops OS scratch
    // files, honours every .gitignore.
    filters: commonFilters,
    onFilesChanged: (changed) => {
      for (const [path] of changed) {
        console.log("changed", path);
      }
    },
  });

  if (!isBrowserSupported) {
    return <p>Needs Chrome, Edge or Opera.</p>;
  }

  return (
    <>
      <button onClick={() => onDirectorySelection()}>
        Open a folder
      </button>
      {Array.from(files, ([path, contents]) => (
        <textarea
          key={path}
          defaultValue={contents}
          onBlur={(e) => writeFile(path, e.target.value)}
        />
      ))}
    </>
  );
}
`;

/** Genuinely ordered: each pass through the tree runs these in sequence. */
const PIPELINE = [
	{
		title: "Walk",
		body: "Breadth-first, with a bounded number of directories open at once. A filter that rejects a directory prunes the whole subtree, so node_modules is never enumerated.",
	},
	{
		title: "Stat",
		body: "Every discovered file is stat'd first. Contents are re-read only when lastModified or size moved, so polling a large tree at rest does no content I/O.",
	},
	{
		title: "Diff",
		body: "Added, changed and deleted are resolved against the previous scan. Rendered state is coalesced by debounceInterval; callbacks always fire immediately.",
	},
];

export const Usage = () => (
	<section className="u-shell border-line border-b py-16 lg:py-20">
		<div className="grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-14">
			<div className="min-w-0">
				<p className="u-eyebrow">The whole integration</p>
				<h2 className="u-h2 mt-4">One hook, one folder.</h2>
				<Code
					className="mt-7"
					filename="editor.tsx"
					code={SNIPPET}
					numbered={true}
				/>
			</div>

			<div className="min-w-0">
				<p className="u-eyebrow">What one scan does</p>
				<h2 className="u-h2 mt-4">Every 300ms, in order.</h2>

				<ol className="mt-7 border-line-strong border-l">
					{PIPELINE.map((stage, i) => (
						<li key={stage.title} className="relative py-5 pl-7">
							<span
								aria-hidden="true"
								className="absolute top-[25px] -left-[4.5px] h-2 w-2 bg-chg"
							/>
							<div className="flex items-baseline gap-3">
								<span className="u-eyebrow text-chg">
									{String(i + 1).padStart(2, "0")}
								</span>
								<h3 className="font-display font-semibold text-[13px] text-text tracking-[-0.02em]">
									{stage.title}
								</h3>
							</div>
							<p className="mt-2 max-w-[52ch] text-[13px] text-dim leading-relaxed">
								{stage.body}
							</p>
						</li>
					))}
				</ol>

				<p className="mt-6 border-line border-t pt-6 text-[13px] text-dim leading-relaxed">
					<span className="text-text">Scans never throw.</span> A directory that
					cannot be enumerated — permission revoked, folder moved — keeps its
					last known contents instead of reporting every file as deleted, and
					the reason is surfaced through{" "}
					<span className="text-text">error</span>.
				</p>
			</div>
		</div>
	</section>
);
