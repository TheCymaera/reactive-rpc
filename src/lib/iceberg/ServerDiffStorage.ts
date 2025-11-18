import { RequestObject } from "./core.js";

export interface ServerDiffStorage {
	getResponse(request: RequestObject, responseHash: string): Promise<string | undefined>;
	setResponse(request: RequestObject, responseHash: string, response: string): Promise<void>;
}

export class InMemoryServerDiffStorage implements ServerDiffStorage {
	// User -> Procedure ID -> Inputs & Hash -> Response
	readonly #storedResponses: Map<string, Map<string, Map<string, string>>> = new Map();
	readonly maxResponsesPerProcedure = 5;

	constructor(private readonly currentUser: () => string) {}

	async getResponse(request: RequestObject, responseHash: string) {
		const userId = this.currentUser();
		const procedureId = request.procedureName;
		const key = this.#key(request, responseHash);

		return this.#storedResponses.get(userId)?.get(procedureId)?.get(key);
	}

	async setResponse(request: RequestObject, responseHash: string, response: string) {
		const userId = this.currentUser();
		const procedureId = request.procedureName;
		const key = this.#key(request, responseHash);

		const responses = this.#ensureProcedureMap(userId, procedureId);
		responses.set(key, response);
		this.#evictOld(responses, this.maxResponsesPerProcedure);
	}

	#ensureProcedureMap(userId: string, procedureId: string): Map<string, string> {
		let userMap = this.#storedResponses.get(userId);
		if (!userMap) {
			userMap = new Map();
			this.#storedResponses.set(userId, userMap);
		}
		let procMap = userMap.get(procedureId);
		if (!procMap) {
			procMap = new Map();
			userMap.set(procedureId, procMap);
		}
		return procMap;
	}

	#evictOld(map: Map<string, string>, maxSize: number) {
		while (map.size > maxSize) {
			const firstKey = map.keys().next().value;
			if (!firstKey) break;
			map.delete(firstKey);
		}
	}

	#key(request: RequestObject, responseHash: string): string {
		return JSON.stringify(request.input) + ':' + responseHash;
	}
}