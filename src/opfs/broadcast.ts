import type { OpfsBroadcastMessage, OpfsChange } from "../types";

/**
 * BroadcastChannel wrapper for cross-tab OPFS synchronization
 *
 * Allows multiple tabs to stay in sync when any tab modifies the OPFS.
 * Each tab broadcasts its changes, and other tabs can subscribe to receive them.
 */
export class OpfsBroadcast {
	private channel: BroadcastChannel | null = null;
	private tabId: string;
	private listeners: Set<(changes: OpfsChange[], source: string) => void> =
		new Set();

	constructor(channelName = "use-opfs") {
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

	/** Broadcast changes to other tabs */
	broadcast(changes: OpfsChange[]): void {
		if (!this.channel || changes.length === 0) {
			return;
		}

		const message: OpfsBroadcastMessage = {
			type: "changes",
			changes,
			source: this.tabId,
		};

		this.channel.postMessage(message);
	}

	/** Subscribe to changes from other tabs */
	subscribe(
		listener: (changes: OpfsChange[], source: string) => void,
	): () => void {
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

	private handleMessage = (event: MessageEvent<OpfsBroadcastMessage>): void => {
		const message = event.data;

		// Ignore messages from self
		if (message.source === this.tabId) {
			return;
		}

		// Notify all listeners
		for (const listener of this.listeners) {
			listener(message.changes, message.source);
		}
	};
}
