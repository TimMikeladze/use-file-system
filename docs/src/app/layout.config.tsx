import { Icon } from "@iconify/react";
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

/**
 * Shared layout configurations
 *
 * you can configure layouts individually from:
 * Home Layout: app/(home)/layout.tsx
 * Docs Layout: app/docs/layout.tsx
 */

/** A folder with a heartbeat running through it — the library in one glyph. */
const Mark = () => (
	<svg
		viewBox="0 0 24 24"
		aria-hidden="true"
		className="h-[22px] w-[22px] shrink-0"
		fill="none"
	>
		<path
			d="M2.75 6.25A1.5 1.5 0 0 1 4.25 4.75h4.4a1.5 1.5 0 0 1 1.06.44l1.31 1.31h8.73a1.5 1.5 0 0 1 1.5 1.5v9.25a1.5 1.5 0 0 1-1.5 1.5H4.25a1.5 1.5 0 0 1-1.5-1.5z"
			stroke="currentColor"
			strokeOpacity="0.45"
			strokeWidth="1.4"
		/>
		<path
			d="M5.5 13.4h3l1.6-3.4 2.2 6 1.6-2.6h4.6"
			stroke="var(--chg)"
			strokeWidth="1.6"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
	</svg>
);

/**
 * The tagline rides in the app bar when there is room for it; below `lg` the
 * hero shows it on its own line instead. Rendered through `nav.children` so
 * the MDN link is a sibling of the title link, not nested inside it.
 */
const Tagline = () => (
	<span className="ms-4 hidden items-center gap-2 border-line border-l py-1 ps-4 lg:inline-flex">
		<span className="u-eyebrow">a React hook for the</span>
		<a
			href="https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API"
			target="_blank"
			rel="noopener noreferrer"
			className="u-eyebrow text-chg underline decoration-chg/30 underline-offset-4 hover:decoration-chg"
		>
			File System Access API
		</a>
		<span className="u-eyebrow">+</span>
		<a
			href="https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system"
			target="_blank"
			rel="noopener noreferrer"
			className="u-eyebrow text-add underline decoration-add/30 underline-offset-4 hover:decoration-add"
		>
			OPFS
		</a>
	</span>
);

export const baseOptions: BaseLayoutProps = {
	nav: {
		children: <Tagline />,
		title: (
			<div className="flex items-center gap-2">
				<Mark />
				<span className="font-display font-semibold text-[15px] tracking-[-0.03em]">
					use-fs
				</span>
			</div>
		),
	},
	links: [
		// {
		// 	text: "Documentation",
		// 	url: "/docs",
		// 	active: "nested-url",
		// },
		{
			text: "@linesofcode",
			url: "https://linesofcode.dev",
			type: "icon",
			icon: <Icon icon="meteor-icons:at" />,
		},
		{
			text: "Bluesky",
			url: "https://bsky.app/profile/linesofcode.bsky.social",
			type: "icon",
			icon: <Icon icon="meteor-icons:bluesky" />,
		},
		{
			text: "Twitter",
			url: "https://x.com/linesofcode",
			type: "icon",
			icon: <Icon icon="meteor-icons:x" />,
		},
	],
	githubUrl: "https://github.com/TimMikeladze/use-fs",
};
