"use client";
import Demo from "./Demo";
import { Events } from "./Events";
import { Footer } from "./Footer";
import { FsProvider } from "./FsStore";
import { Hero } from "./Hero";
import { Surface } from "./Surface";
import { Usage } from "./Usage";

export default function HomePage() {
	return (
		// One watcher, shared by the hero panel and the playground below it.
		<FsProvider>
			<main className="flex flex-1 flex-col">
				<Hero />
				<Events />
				<Usage />
				<Demo />
				<Surface />
				<Footer />
			</main>
		</FsProvider>
	);
}
