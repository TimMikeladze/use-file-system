import path from "node:path";
import { fileURLToPath } from "node:url";
import { createMDX } from "fumadocs-mdx/next";

const withMDX = createMDX();

const docsDirectory = path.dirname(fileURLToPath(import.meta.url));

/**
 * `use-fs` is linked from the repository root (`link:..`) so the demo always
 * runs the local build rather than a published release.
 *
 * The linked package resolves its own dependencies from the repository root, so
 * without this alias React would be loaded twice - once for the app and once for
 * the hook - and every hook call inside `use-fs` would throw "Invalid hook
 * call".
 */
const dedupeReact = (config) => {
	config.resolve.alias = {
		...config.resolve.alias,
		react: path.resolve(docsDirectory, "node_modules/react"),
		"react-dom": path.resolve(docsDirectory, "node_modules/react-dom"),
	};

	return config;
};

/** @type {import('next').NextConfig} */
const config = {
	reactStrictMode: true,
	webpack: dedupeReact,
};

export default withMDX(config);
