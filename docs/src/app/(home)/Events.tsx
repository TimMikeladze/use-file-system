import { GLYPH, TONE } from "./signals";

/**
 * The hook reports exactly three things. They are the page's whole palette,
 * so introducing them explicitly teaches the colour code for everything below.
 */
const EVENTS = [
	{
		kind: "added" as const,
		name: "onFilesAdded",
		signature: "(newFiles, previousFiles)",
		body: "A path the previous scan did not have. Filters run first, so a pruned directory never even gets enumerated.",
	},
	{
		kind: "changed" as const,
		name: "onFilesChanged",
		signature: "(changedFiles, previousFiles)",
		body: "Same path, different bytes. Contents are only re-read when lastModified or size moved, so a steady tree costs no I/O.",
	},
	{
		kind: "deleted" as const,
		name: "onFilesDeleted",
		signature: "(deletedFiles, previousFiles)",
		body: "The path is gone. You still get its last contents, so you can archive it, undo it, or put it back.",
	},
];

export const Events = () => (
	<section className="u-rule border-line border-b bg-panel">
		<div className="u-shell grid divide-line md:grid-cols-3 md:divide-x">
			{EVENTS.map((event) => (
				<article
					key={event.name}
					className="border-line border-b py-8 last:border-b-0 md:border-b-0 md:px-7 md:last:pr-0 md:first:pl-0"
				>
					<div className="flex items-baseline gap-3">
						<span
							aria-hidden="true"
							className={`u-display font-bold text-[2rem] leading-none ${TONE[event.kind]}`}
						>
							{GLYPH[event.kind]}
						</span>
						<h2 className="font-medium text-[14px] text-text">{event.name}</h2>
					</div>
					<p className="mt-3 text-[11.5px] text-faint">{event.signature}</p>
					<p className="mt-3 max-w-[42ch] text-[13px] text-dim leading-relaxed">
						{event.body}
					</p>
				</article>
			))}
		</div>
	</section>
);
