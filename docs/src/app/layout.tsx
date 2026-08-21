import "./global.css";
import process from "node:process";
import { RootProvider } from "fumadocs-ui/provider/next";
import { Geist_Mono, Martian_Mono } from "next/font/google";
import type { ReactNode } from "react";

// Everything on this page is a path, so everything on this page is monospace.
// Hierarchy comes from width and weight instead of a serif/sans contrast:
// Martian Mono runs wide for display, Geist Mono stays narrow for reading.
const display = Martian_Mono({
	subsets: ["latin"],
	variable: "--font-display",
	axes: ["wdth"],
	display: "swap",
});

const mono = Geist_Mono({
	subsets: ["latin"],
	variable: "--font-mono",
	display: "swap",
});

export default function Layout({ children }: { children: ReactNode }) {
	return (
		<html
			lang="en"
			// `dark` here matches what next-themes writes before paint, so the
			// first frame is already dark instead of flashing light.
			className={`dark ${display.variable} ${mono.variable}`}
			suppressHydrationWarning={true}
		>
			{Boolean(
				process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID &&
					process.env.NEXT_PUBLIC_UMAMI_URL,
			) && (
				<script
					defer={true}
					src={`${process.env.NEXT_PUBLIC_UMAMI_URL}/script.js`}
					data-website-id={process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID}
				/>
			)}
			<body className="flex min-h-screen flex-col antialiased">
				<RootProvider
					theme={{
						defaultTheme: "dark",
						enableSystem: false,
					}}
					search={{
						enabled: false,
					}}
				>
					{children}
				</RootProvider>
			</body>
		</html>
	);
}
