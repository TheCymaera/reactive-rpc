import type { ParsedRequest } from "./core.js";

export interface ClientDiffStorage {
	getResponse(request: ParsedRequest): Promise<{ hash: string, response: unknown } | undefined>;
	setResponse(request: ParsedRequest, data: { hash: string, response: unknown }): Promise<void>;
}

export class InMemoryClientDiffStorage implements ClientDiffStorage {
	readonly storedResponses: Map<string, { hash: string, response: unknown }> = new Map();
	readonly maxStoredResponses = 100;

	async getResponse(request: ParsedRequest) {
		const stored = this.storedResponses.get(JSON.stringify(request));
		return stored;
	}

	async setResponse(request: ParsedRequest, data: { hash: string, response: unknown }) {
		this.#evictOldResponses();
		this.storedResponses.set(JSON.stringify(request), data);
	}

	#evictOldResponses() {
		while (this.storedResponses.size > this.maxStoredResponses) {
			const firstKey = this.storedResponses.keys().next().value;
			if (!firstKey) break;
			this.storedResponses.delete(firstKey);
		}
	}
}