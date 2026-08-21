import { readFile } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";
import { ImageResponse } from "next/og";
import { metadataImage } from "@/lib/metadata";

// The card is the landing page in miniature: the same ground, the same 24px
// lattice, the same three event colours, and a watcher panel showing the only
// three things this library ever reports.
const GROUND = "#080a0f";
const PANEL = "#0c0f16";
const RAISED = "#10141d";
const TEXT = "#e6eaf2";
const DIM = "#939eaf";
const FAINT = "#626d7e";
const ADD = "#4fdda5";
const CHG = "#f4b13c";
const DEL = "#ff7a72";
const CODE_FN = "#7fb4f5";
const LINE = "rgba(255,255,255,0.09)";
// Held in a constant because biome rewrites a `//` JSX text node into a real
// JSX comment, which would drop the line from the card.
const CODE_NOTE = "// no picker, no prompt, no gesture";
const CELL = 24;
const WIDTH = 1200;
const HEIGHT = 630;
const PANEL_X = 660;
const PANEL_Y = 92;
const PANEL_W = 468;
const PANEL_H = 446;

// Read once at build time - the route is fully prerendered. The paths are
// literals so the bundler traces `assets/fonts` and nothing else.
const [mono, monoBold, display] = await Promise.all([
	readFile(join(process.cwd(), "assets/fonts/GeistMono-Regular.ttf")),
	readFile(join(process.cwd(), "assets/fonts/GeistMono-Bold.ttf")),
	readFile(join(process.cwd(), "assets/fonts/MartianMono-Bold.ttf")),
]);

const gridLines = () => {
	const lines = [];

	for (let x = CELL; x < WIDTH; x += CELL) {
		lines.push(
			<div
				key={`v${x}`}
				style={{
					position: "absolute",
					left: x,
					top: 0,
					width: 1,
					height: HEIGHT,
					background: "rgba(255,255,255,0.014)",
				}}
			/>,
		);
	}

	for (let y = CELL; y < HEIGHT; y += CELL) {
		lines.push(
			<div
				key={`h${y}`}
				style={{
					position: "absolute",
					left: 0,
					top: y,
					width: WIDTH,
					height: 1,
					background: "rgba(255,255,255,0.014)",
				}}
			/>,
		);
	}

	return lines;
};

interface ChipProps {
	label: string;
	accent?: boolean;
}

const Chip = ({ label, accent }: ChipProps) => (
	<div
		style={{
			display: "flex",
			alignItems: "center",
			height: 34,
			padding: "0 20px",
			marginRight: 14,
			borderRadius: 17,
			fontSize: 14,
			color: accent ? ADD : DIM,
			background: accent ? "rgba(79,221,165,0.12)" : "rgba(255,255,255,0.05)",
			border: `1px solid ${accent ? "rgba(79,221,165,0.42)" : "rgba(255,255,255,0.14)"}`,
		}}
	>
		{label}
	</div>
);

interface RowProps {
	color: string;
	marker: string;
	file: string;
	label: string;
	top: number;
	struck?: boolean;
}

const Row = ({ color, marker, file, label, top, struck }: RowProps) => (
	<div
		style={{
			position: "absolute",
			left: 0,
			top,
			display: "flex",
			alignItems: "center",
			width: PANEL_W,
			height: 52,
			background: `${color}1a`,
		}}
	>
		<div
			style={{
				position: "absolute",
				left: 0,
				top: 0,
				width: 3,
				height: 52,
				background: color,
			}}
		/>
		<div style={{ width: 28, marginLeft: 28, fontSize: 15, color }}>
			{marker}
		</div>
		<div
			style={{
				fontSize: 15,
				color: struck ? FAINT : TEXT,
				textDecoration: struck ? "line-through" : "none",
			}}
		>
			{file}
		</div>
		<div
			style={{
				marginLeft: "auto",
				marginRight: 28,
				fontSize: 12,
				letterSpacing: 1.6,
				color,
			}}
		>
			{label}
		</div>
	</div>
);

export const GET = metadataImage.createAPI((page) => {
	// The index page is the product itself, so it keeps the pitch. Any other
	// page speaks for itself and gets its own title instead.
	const isIndex = page.slugs.length === 0;
	const headline = isIndex
		? ["A React hook that watches a", "directory and re-renders on change."]
		: [page.data.title];
	const subline = isIndex
		? ["Point it at a folder on disk, or at the", "origin private file system."]
		: [page.data.description ?? ""];

	return new ImageResponse(
		<div
			style={{
				position: "relative",
				display: "flex",
				width: WIDTH,
				height: HEIGHT,
				backgroundColor: GROUND,
				backgroundImage:
					"linear-gradient(135deg, rgba(79,221,165,0.10) 0%, rgba(244,177,60,0.04) 55%, rgba(255,122,114,0.07) 100%)",
				fontFamily: "Geist Mono",
			}}
		>
			{gridLines()}

			{/* left column */}
			<div
				style={{
					position: "absolute",
					left: 72,
					top: 84,
					display: "flex",
					flexDirection: "column",
					width: 540,
				}}
			>
				<div style={{ display: "flex", alignItems: "center", height: 16 }}>
					<div style={{ width: 7, height: 7, background: ADD }} />
					<div
						style={{
							marginLeft: 13,
							fontSize: 14,
							letterSpacing: 3.4,
							color: FAINT,
						}}
					>
						REACT HOOK
					</div>
				</div>

				<div
					style={{
						marginTop: 26,
						fontFamily: "Martian Mono",
						fontWeight: 700,
						fontSize: 64,
						letterSpacing: -2,
						color: TEXT,
					}}
				>
					use-fs
				</div>

				<div
					style={{
						marginTop: 30,
						width: 488,
						height: 1,
						background: "rgba(255,255,255,0.10)",
					}}
				/>

				<div
					style={{
						marginTop: 26,
						display: "flex",
						flexDirection: "column",
						fontSize: 25,
						lineHeight: 1.42,
						letterSpacing: -0.4,
						color: TEXT,
					}}
				>
					{headline.map((line) => (
						<div key={line}>{line}</div>
					))}
				</div>

				<div
					style={{
						marginTop: 22,
						display: "flex",
						flexDirection: "column",
						fontSize: 17,
						lineHeight: 1.5,
						color: DIM,
					}}
				>
					{subline.map((line) => (
						<div key={line}>{line}</div>
					))}
				</div>

				<div style={{ display: "flex", marginTop: 30 }}>
					<Chip accent={true} label="OPFS support" />
					<Chip label="Safari 17+ · Firefox 111+" />
				</div>

				<div style={{ display: "flex", marginTop: 12 }}>
					<Chip label=".gitignore filters" />
					<Chip label="read · write · delete" />
				</div>

				<div style={{ display: "flex", marginTop: 34, fontSize: 18 }}>
					<div style={{ color: CHG }}>npm i use-fs</div>
					<div style={{ marginLeft: 18, color: FAINT }}>·</div>
					<div style={{ marginLeft: 18, color: FAINT }}>use-fs.com</div>
				</div>
			</div>

			{/* the watcher */}
			<div
				style={{
					position: "absolute",
					left: PANEL_X,
					top: PANEL_Y,
					display: "flex",
					width: PANEL_W,
					height: PANEL_H,
					borderRadius: 14,
					background: PANEL,
					border: `1px solid ${LINE}`,
					overflow: "hidden",
				}}
			>
				<div
					style={{
						position: "absolute",
						left: 0,
						top: 0,
						display: "flex",
						alignItems: "center",
						width: PANEL_W,
						height: 52,
						background: RAISED,
						borderBottom: `1px solid ${LINE}`,
					}}
				>
					<div style={{ marginLeft: 28, fontSize: 15, color: TEXT }}>
						notes/
					</div>
					<div
						style={{
							display: "flex",
							alignItems: "center",
							marginLeft: "auto",
							marginRight: 24,
						}}
					>
						<div style={{ fontSize: 12, letterSpacing: 1.2, color: FAINT }}>
							polling
						</div>
						<div
							style={{
								width: 8,
								height: 8,
								marginLeft: 12,
								borderRadius: 4,
								background: ADD,
							}}
						/>
					</div>
				</div>

				<Row
					color={ADD}
					marker="+"
					file="notes/todo.md"
					label="ADDED"
					top={72}
				/>
				<Row
					color={CHG}
					marker="~"
					file="notes/draft.md"
					label="CHANGED"
					top={140}
				/>
				<Row
					color={DEL}
					marker="−"
					file="notes/scratch.txt"
					label="DELETED"
					top={208}
					struck={true}
				/>

				<div
					style={{
						position: "absolute",
						left: 0,
						top: 292,
						width: PANEL_W,
						height: 1,
						background: LINE,
					}}
				/>

				<div
					style={{
						position: "absolute",
						left: 28,
						top: 316,
						display: "flex",
						flexDirection: "column",
						fontSize: 14.5,
						lineHeight: 1.8,
					}}
				>
					<div style={{ display: "flex" }}>
						<div style={{ color: CODE_FN }}>const</div>
						<div style={{ marginLeft: 8, color: TEXT }}>{"{ files,"}</div>
						<div style={{ marginLeft: 8, color: ADD }}>addOpfsDirectory</div>
						<div style={{ marginLeft: 8, color: TEXT }}>{"} ="}</div>
					</div>
					<div style={{ display: "flex" }}>
						<div style={{ marginLeft: 16, color: CODE_FN }}>useFs</div>
						<div style={{ color: TEXT }}>{"({ onFilesChanged })"}</div>
					</div>
					<div style={{ display: "flex", marginTop: 18 }}>
						<div style={{ color: TEXT }}>addOpfsDirectory</div>
						<div style={{ color: FAINT }}>{"({ name:"}</div>
						<div style={{ marginLeft: 8, color: CHG }}>"notes"</div>
						<div style={{ marginLeft: 8, color: FAINT }}>{"})"}</div>
					</div>
					<div style={{ marginTop: 6, fontSize: 12.5, color: FAINT }}>
						{CODE_NOTE}
					</div>
				</div>
			</div>
		</div>,
		{
			width: WIDTH,
			height: HEIGHT,
			fonts: [
				{ name: "Geist Mono", data: mono, weight: 400, style: "normal" },
				{ name: "Geist Mono", data: monoBold, weight: 700, style: "normal" },
				{ name: "Martian Mono", data: display, weight: 700, style: "normal" },
			],
		},
	);
});

export function generateStaticParams() {
	return metadataImage.generateParams();
}

// Every page is known at build time, so the fonts are only ever read there.
export const dynamicParams = false;
