"use client";

import { Highlight, type PrismTheme } from "prism-react-renderer";
import type { ReactNode } from "react";

/**
 * Syntax colours are the same three event colours the rest of the page uses,
 * plus one blue for callables, so code never introduces a palette of its own.
 * Every value is a CSS variable, so light and dark are handled by the theme.
 */
const inkTheme: PrismTheme = {
	plain: { color: "var(--text-dim)", backgroundColor: "transparent" },
	styles: [
		{
			types: ["comment", "prolog", "doctype", "cdata"],
			style: { color: "var(--text-faint)", fontStyle: "italic" },
		},
		{ types: ["punctuation"], style: { color: "var(--text-faint)" } },
		{
			types: ["keyword", "operator", "module", "control-flow"],
			style: { color: "var(--chg)" },
		},
		{ types: ["string", "char", "attr-value"], style: { color: "var(--add)" } },
		{
			types: ["number", "boolean", "constant", "regex"],
			style: { color: "var(--del)" },
		},
		{
			types: ["function", "class-name", "maybe-class-name", "tag"],
			style: { color: "var(--code-fn)" },
		},
		{
			types: ["attr-name", "property", "property-access"],
			style: { color: "var(--text)" },
		},
		{ types: ["imports", "variable"], style: { color: "var(--text)" } },
		{ types: ["plain"], style: { color: "var(--text-dim)" } },
	],
};

interface CodeProps {
	code: string;
	language?: string;
	/** Shown in the frame's tab. Omit for a bare block. */
	filename?: string;
	action?: ReactNode;
	className?: string;
	numbered?: boolean;
}

export const Code = ({
	code,
	language = "tsx",
	filename,
	action,
	className = "",
	numbered = false,
}: CodeProps) => (
	<div
		className={`overflow-hidden border border-line bg-panel ${className}`.trim()}
	>
		{(filename || action) && (
			<div className="flex items-center justify-between gap-3 border-line border-b bg-raised px-4 py-2.5">
				<span className="u-eyebrow truncate">{filename}</span>
				{action}
			</div>
		)}
		<Highlight theme={inkTheme} code={code.trim()} language={language}>
			{({ style, tokens, getLineProps, getTokenProps }) => (
				<pre
					className="u-scroll overflow-x-auto px-4 py-4 text-[12.5px] leading-[1.75] sm:text-[13px]"
					style={style}
				>
					{tokens.map((line, i) => (
						<div
							// biome-ignore lint/suspicious/noArrayIndexKey: token lines are positional
							key={i}
							{...getLineProps({ line })}
							className="flex whitespace-pre"
						>
							{numbered && (
								<span className="mr-4 w-6 shrink-0 select-none text-right text-[11px] text-faint tabular-nums">
									{i + 1}
								</span>
							)}
							<span>
								{line.map((token, key) => (
									// biome-ignore lint/suspicious/noArrayIndexKey: tokens are positional
									<span key={key} {...getTokenProps({ token })} />
								))}
							</span>
						</div>
					))}
				</pre>
			)}
		</Highlight>
	</div>
);
