import { generateOGImage } from "fumadocs-ui/og";
import { metadataImage } from "@/lib/metadata";

export const GET = metadataImage.createAPI((_page) =>
	generateOGImage({
		title: "use-fs",
		description: "A React hook for integrating with the File System Access API",
		site: "use-fs",
	}),
);

export function generateStaticParams() {
	return metadataImage.generateParams();
}
