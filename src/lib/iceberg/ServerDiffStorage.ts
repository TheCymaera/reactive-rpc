import { ParsedRequest } from "./core.js";

export interface ServerDiffStorage {
	getResponse(request: ParsedRequest, responseHash: string): Promise<string | undefined>;
	setResponse(request: ParsedRequest, responseHash: string, response: string): Promise<void>;
}

export class InMemoryServerDiffStorage implements ServerDiffStorage {
	readonly #storedResponses: Map<string, string> = new Map();
	readonly maxStoredResponses = 100;


	async getResponse(request: ParsedRequest, responseHash: string) {
		const key = this.#key(request, responseHash);

		return this.#storedResponses.get(key);
	}

	async setResponse(request: ParsedRequest, responseHash: string, response: string) {
		const key = this.#key(request, responseHash);

		this.#storedResponses.delete(key); // delete to refresh order
		this.#storedResponses.set(key, response);
		this.#evictOld(this.#storedResponses, this.maxStoredResponses);
	}

	#evictOld(map: Map<string, string>, maxSize: number) {
		while (map.size > maxSize) {
			const firstKey = map.keys().next().value;
			if (!firstKey) break;
			map.delete(firstKey);
		}
	}

	#key(_request: ParsedRequest, responseHash: string): string {
		return responseHash;
	}
}