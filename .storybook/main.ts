import type { StorybookConfig } from "@storybook/react-webpack5";

const config: StorybookConfig = {
	stories: ["../src/**/*.stories.@(js|jsx|ts|tsx|mdx)"],
	// The essentials, interactions and actions addons ship inside the Storybook
	// core package from v9 onwards, so only the extras are listed here.
	addons: ["@storybook/addon-links", "@storybook/addon-webpack5-compiler-swc"],
	framework: {
		name: "@storybook/react-webpack5",
		options: {
			builder: {
				useSWC: true,
			},
		},
	},
	swc: () => ({
		jsc: {
			transform: {
				react: {
					runtime: "automatic",
				},
			},
		},
	}),
};
export default config;
