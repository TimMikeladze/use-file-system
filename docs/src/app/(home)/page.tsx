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
		title: "use-fs • your folder is now state",
		description:
			"A React hook for the File System Access API. Point useFs() at a directory on disk and your component re-renders whenever a file is added, changed or deleted.",
	});
}

export default function Page() {
	return <HomePage />;
}
