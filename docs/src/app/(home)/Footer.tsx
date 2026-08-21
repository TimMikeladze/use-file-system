const LINKS = [
	{ label: "GitHub", href: "https://github.com/TimMikeladze/use-fs" },
	{ label: "npm", href: "https://www.npmjs.com/package/use-fs" },
	{
		label: "MDN · File System Access API",
		href: "https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API",
	},
	{
		label: "MDN · Origin private file system",
		href: "https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system",
	},
];

export const Footer = () => (
	<footer className="border-line border-t">
		<div className="u-shell py-16 lg:py-20">
			<p className="u-eyebrow">Get it</p>
			<p className="u-display mt-4 font-semibold text-[clamp(1.35rem,4.4vw,2.4rem)] text-text">
				npm install <span className="text-chg">use-fs</span>
			</p>

			<div className="mt-12 flex flex-wrap items-center justify-between gap-x-8 gap-y-4 border-line border-t pt-6">
				<nav className="flex flex-wrap items-center gap-x-6 gap-y-2">
					{LINKS.map((link) => (
						<a
							key={link.href}
							href={link.href}
							target="_blank"
							rel="noopener noreferrer"
							className="text-[12px] text-dim transition-colors hover:text-text"
						>
							{link.label}
						</a>
					))}
				</nav>
				<p className="text-[12px] text-faint">
					MIT · built by{" "}
					<a
						href="https://linesofcode.dev"
						target="_blank"
						rel="noopener noreferrer"
						className="text-dim transition-colors hover:text-chg"
					>
						linesofcode.dev
					</a>
				</p>
			</div>
		</div>
	</footer>
);
