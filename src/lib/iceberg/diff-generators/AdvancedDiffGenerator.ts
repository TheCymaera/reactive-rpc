import type { ParsedRequest } from "../core.js";
import type { DiffGenerator } from "./DiffGenerator.js";
import { createJsonPatch, type JSONPatch } from "./jsonPatch.js";
import type { ServerDiffStorage } from "./storage/ServerDiffStorage.js";

export class AdvancedDiffGenerator implements DiffGenerator {
	constructor(private storage: ServerDiffStorage) {}

	async generateDiffResponse(
		request: ParsedRequest,
		previousResponseHash: string | undefined,
		currentResponseHash: string,
		currentResponse: unknown
	): Promise<JSONPatch | undefined> {
		if (previousResponseHash === undefined) {
			return undefined;
		}

		const previousResponse = await this.storage.getResponse(request, previousResponseHash);

		await this.storage.setResponse(request, currentResponseHash, currentResponse);

		if (previousResponse === undefined) {
			return undefined;
		}

		const patch = createJsonPatch(previousResponse, currentResponse);

		const patchSize = JSON.stringify(patch).length;
		const responseSize = JSON.stringify(currentResponse).length;

		if (patchSize >= responseSize) return undefined;
		
		return patch;
	}
}