/**
 * The three things the hook reports. Every accent colour on the page is one of
 * them, so the palette itself teaches the API.
 */
export type Signal = "added" | "changed" | "deleted";

export const GLYPH: Record<Signal, string> = {
	added: "+",
	changed: "~",
	deleted: "-",
};

export const TONE: Record<Signal, string> = {
	added: "text-add",
	changed: "text-chg",
	deleted: "text-del",
};

export const BED: Record<Signal, string> = {
	added: "bg-add-bed",
	changed: "bg-chg-bed",
	deleted: "bg-del-bed",
};
