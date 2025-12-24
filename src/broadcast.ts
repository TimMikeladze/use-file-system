import type { FileChange } from "./types";

/**
 * BroadcastChannel wrapper for cross-tab file system synchronization
 *
 * Allows multiple tabs to stay in sync when any tab modifies files.
 * Each tab broadcasts its changes, and other tabs update their state optimistically.
 */

export interface FsBroadcastMessage {
	type: "changes" | "handle-available";
	changes?: FileChange[];
	source: string;
}

export class FsBroadcast {
	private channel: BroadcastChannel | null = null;
	private tabId: string;
	private listeners: Set<(message: FsBroadcastMessage) => void> = new Set();

	constructor(channelName = "use-fs") {
		this.tabId = crypto.randomUUID();

		if (typeof BroadcastChannel !== "undefined") {
			this.channel = new BroadcastChannel(channelName);
			this.channel.onmessage = this.handleMessage;
		}
	}

	/** Whether BroadcastChannel is available */
	get isConnected(): boolean {
		return this.channel !== null;
	}

	/** Unique identifier for this tab */
	get id(): string {
		return this.tabId;
	}

	/** Broadcast file changes to other tabs */
	broadcastChanges(changes: FileChange[]): void {
		if (!this.channel || changes.length === 0) {
			return;
		}

		const message: FsBroadcastMessage = {
			type: "changes",
			changes,
			source: this.tabId,
		};

		this.channel.postMessage(message);
	}

	/** Notify other tabs that a handle is now available in IndexedDB */
	broadcastHandleAvailable(): void {
		if (!this.channel) {
			return;
		}

		const message: FsBroadcastMessage = {
			type: "handle-available",
			source: this.tabId,
		};

		this.channel.postMessage(message);
	}

	/** Subscribe to messages from other tabs */
	subscribe(listener: (message: FsBroadcastMessage) => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	/** Clean up resources */
	close(): void {
		if (this.channel) {
			this.channel.close();
			this.channel = null;
		}
		this.listeners.clear();
	}

	private handleMessage = (event: MessageEvent<FsBroadcastMessage>): void => {
		const message = event.data;

		// Ignore messages from self
		if (message.source === this.tabId) {
			return;
		}

		// Notify all listeners
		for (const listener of this.listeners) {
			listener(message);
		}
	};
}
