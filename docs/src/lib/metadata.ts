import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { source } from "@/lib/source";

// fumadocs-core 16 dropped `createMetadataImage`, so the three helpers the docs
// site used are reimplemented here against the loader's public API. Pages are
// served at `/docs-og/<...slug>/image.png`; the trailing filename only exists so
// the route ends in an image extension, and is stripped again when resolving.
const IMAGE_ROUTE = "/docs-og";
const IMAGE_FILENAME = "image.png";

interface OgParams {
	slug: string[];
}
type Page = NonNullable<ReturnType<typeof source.getPage>>;
interface RouteContext {
	params: Promise<OgParams>;
}

const imageUrl = (slugs: string[]) =>
	[IMAGE_ROUTE, ...slugs, IMAGE_FILENAME].join("/");

export const metadataImage = {
	/** Point a page's Open Graph and Twitter cards at its generated image. */
	withImage(slugs: string[], metadata: Metadata): Metadata {
		const url = imageUrl(slugs);

		return {
			...metadata,
			openGraph: {
				images: url,
				...metadata.openGraph,
			},
			twitter: {
				card: "summary_large_image",
				images: url,
				...metadata.twitter,
			},
		};
	},

	/** Static params for every page, with the image filename appended. */
	generateParams(): OgParams[] {
		return source.generateParams().map((params) => ({
			slug: [...params.slug, IMAGE_FILENAME],
		}));
	},

	/** Wrap a route handler so it receives the page the slug resolves to. */
	createAPI(handler: (page: Page) => Response | Promise<Response>) {
		return async (_request: Request, context: RouteContext) => {
			const { slug } = await context.params;
			const page = source.getPage(slug.slice(0, -1));

			if (!page) {
				notFound();
			}

			return handler(page);
		};
	},
};
