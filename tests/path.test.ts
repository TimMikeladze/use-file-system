import { describe, expect, it } from "vitest";

const NO_TRAVERSAL = /must not contain/;

import {
	basename,
	dirname,
	isAtOrWithin,
	isWithin,
	joinPath,
	normalizePath,
	pathSegments,
} from "../src/path";

describe("path helpers", () => {
	it("joins paths", () => {
		expect(joinPath("a/b", "c.ts")).toBe("a/b/c.ts");
		expect(joinPath("", "c.ts")).toBe("c.ts");
	});

	it("splits basename and dirname", () => {
		expect(basename("a/b/c.ts")).toBe("c.ts");
		expect(basename("c.ts")).toBe("c.ts");
		expect(dirname("a/b/c.ts")).toBe("a/b");
		expect(dirname("c.ts")).toBe("");
	});

	it("lists segments", () => {
		expect(pathSegments("a//b/c")).toEqual(["a", "b", "c"]);
		expect(pathSegments("")).toEqual([]);
	});

	it("distinguishes containment from equality", () => {
		expect(isWithin("root/a", "root")).toBe(true);
		expect(isWithin("root", "root")).toBe(false);
		expect(isWithin("rooted/a", "root")).toBe(false);
		expect(isAtOrWithin("root", "root")).toBe(true);
		expect(isAtOrWithin("root/a/b", "root")).toBe(true);
	});

	describe("normalizePath", () => {
		it("collapses separators", () => {
			expect(normalizePath("/root//a/b/")).toBe("root/a/b");
		});

		it("rejects empty paths", () => {
			expect(() => normalizePath("")).toThrow(TypeError);
			expect(() => normalizePath("///")).toThrow(TypeError);
		});

		it("rejects traversal segments", () => {
			expect(() => normalizePath("root/../../etc/passwd")).toThrow(
				NO_TRAVERSAL,
			);
			expect(() => normalizePath("root/./a")).toThrow(NO_TRAVERSAL);
		});

		it("rejects non-strings", () => {
			expect(() => normalizePath(42 as unknown as string)).toThrow(TypeError);
		});
	});
});
