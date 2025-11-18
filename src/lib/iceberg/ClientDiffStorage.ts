import { RequestObject } from "./core.js";

export interface ClientDiffStorage {
	getResponse(request: RequestObject): Promise<{ hash: string, response: string } | undefined>;
	setResponse(request: RequestObject, data: { hash: string, response: string }): Promise<void>;
}

export class InMemoryClientDiffStorage implements ClientDiffStorage {
	readonly storedResponses: Map<string, { hash: string, response: string }> = new Map();
	readonly maxStoredResponses = 100;

	async getResponse(request: RequestObject) {
		const stored = this.storedResponses.get(JSON.stringify(request));
		return stored;
	}

	async setResponse(request: RequestObject, data: { hash: string, response: string }) {
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