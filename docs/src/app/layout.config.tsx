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

export const baseOptions: BaseLayoutProps = {
	nav: {
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
