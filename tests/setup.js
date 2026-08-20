// biome-ignore lint/performance/noNamespaceImport: matchers are published as a namespace
import * as matchers from "@testing-library/jest-dom/matchers";
import { cleanup } from "@testing-library/react";
import { afterEach, expect } from "vitest";

expect.extend(matchers);

// jsdom does not implement the promise-based `Blob` readers that every browser
// supporting the File System Access API has. Fill them in via `FileReader` so
// `handle.getFile().then((file) => file.text())` behaves like it does in Chrome.
const readWith = (method) =>
	function read() {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => {
				resolve(reader.result);
			};
			reader.onerror = () => {
				reject(reader.error);
			};
			reader[method](this);
		});
	};

if (typeof Blob !== "undefined") {
	if (typeof Blob.prototype.text !== "function") {
		Blob.prototype.text = readWith("readAsText");
	}

	if (typeof Blob.prototype.arrayBuffer !== "function") {
		Blob.prototype.arrayBuffer = readWith("readAsArrayBuffer");
	}
}

afterEach(() => {
	cleanup();
});
