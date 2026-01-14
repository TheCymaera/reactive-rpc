import type { ParsedRequest } from "../../core.js";

export interface ServerDiffStorage {
	getResponse(request: ParsedRequest, responseHash: string): Promise<string | undefined>;
	setResponse(request: ParsedRequest, responseHash: string, response: string): Promise<void>;
}

export class InMemoryServerDiffStorage implements ServerDiffStorage {
	readonly #storedResponses: Map<string, string> = new Map();
	readonly maxStoredResponses = 100;

	// scope hashes to users to prevent oracle attacks
	readonly #userHashes: Map<string, Set<string>> = new Map();
	readonly maxHashesPerUser = 20;

	constructor(private readonly currentUser: ()=>string) {}

	async getResponse(request: ParsedRequest, responseHash: string) {
		const hashBelongsToUser = this.#userHashes.get(this.currentUser())?.has(responseHash);
		if (!hashBelongsToUser) return undefined;

		return this.#storedResponses.get(responseHash);
	}

	async setResponse(request: ParsedRequest, responseHash: string, response: string) {
		const userHashes = this.#userHashes.get(this.currentUser()) || new Set<string>();
		userHashes.add(responseHash);
		this.#userHashes.set(this.currentUser(), userHashes);
		
		// delete old entry so new entry will be added to the end of the stack
		this.#storedResponses.delete(responseHash);
		this.#storedResponses.set(responseHash, response);

		// delete expired hashes
		for (const hash of [...userHashes]) {
			if (!this.#storedResponses.has(hash)) {
				userHashes.delete(hash);
			}
		}

		this.#evictOld(userHashes, this.maxHashesPerUser);
		this.#evictOld(this.#storedResponses, this.maxStoredResponses);
	}

	#evictOld(map: Map<string, string> | Set<string>, maxSize: number) {
		while (map.size > maxSize) {
			const firstKey = map.keys().next().value;
			if (!firstKey) break;
			map.delete(firstKey);
		}
	}
}