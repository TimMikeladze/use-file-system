import { describe, expect, it } from "vitest";
import { isAbortError, isNotFoundError, mapLimit, toError } from "../src/async";

const wait = (ms: number) =>
	new Promise<void>((resolve) => {
		setTimeout(resolve, ms);
	});

describe("mapLimit", () => {
	it("visits every item", async () => {
		const seen: number[] = [];

		await mapLimit([1, 2, 3, 4, 5], 2, async (item) => {
			await wait(0);
			seen.push(item);
		});

		expect(seen.sort()).toEqual([1, 2, 3, 4, 5]);
	});

	it("never exceeds the concurrency limit", async () => {
		let active = 0;
		let peak = 0;

		await mapLimit(
			Array.from({ length: 20 }, (_, i) => i),
			3,
			async () => {
				active += 1;
				peak = Math.max(peak, active);
				await wait(1);
				active -= 1;
			},
		);

		expect(peak).toBeLessThanOrEqual(3);
		expect(peak).toBeGreaterThan(1);
	});

	it("handles an empty list and non-positive limits", async () => {
		await expect(
			mapLimit([], 0, () => Promise.resolve()),
		).resolves.toBeUndefined();

		const seen: number[] = [];
		await mapLimit([1, 2], 0, (item) => {
			seen.push(item);
			return Promise.resolve();
		});

		expect(seen).toEqual([1, 2]);
	});
});

describe("error helpers", () => {
	it("detects DOMException names", () => {
		const abort = new Error("cancelled");
		abort.name = "AbortError";
		const missing = new Error("gone");
		missing.name = "NotFoundError";

		expect(isAbortError(abort)).toBe(true);
		expect(isAbortError(missing)).toBe(false);
		expect(isNotFoundError(missing)).toBe(true);
		expect(isNotFoundError("NotFoundError")).toBe(false);
	});

	it("normalises thrown values", () => {
		const error = new Error("boom");

		expect(toError(error)).toBe(error);
		expect(toError("boom").message).toBe("boom");
		expect(toError({ code: 1 }).message).toBe('{"code":1}');
	});
});
