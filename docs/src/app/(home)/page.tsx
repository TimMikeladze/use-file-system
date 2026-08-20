import { notFound } from "next/navigation";
import { metadataImage } from "@/lib/metadata";
import { source } from "@/lib/source";
import HomePage from "./page.client";

export async function generateMetadata(props: {
	params: Promise<{ slug?: string[] }>;
}) {
	const params = await props.params;
	const page = source.getPage(params.slug);
	if (!page) {
		notFound();
	}

	return metadataImage.withImage(page.slugs, {
		title:
			"use-fs • a React hook for integrating with the File System Access API.",
		description:
			"A React hook for integrating with the File System Access API.",
	});
}

export default function Page() {
	return (
		<div>
			<HomePage />
		</div>
	);
}
