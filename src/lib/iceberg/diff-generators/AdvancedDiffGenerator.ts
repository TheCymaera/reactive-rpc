import type { ParsedRequest } from "../core.js";
import { diff } from "./diff.js";
import type { DiffGenerator } from "./DiffGenerator.js";
import type { ServerDiffStorage } from "./storage/ServerDiffStorage.js";

export class AdvancedDiffGenerator implements DiffGenerator {
	constructor(private storage: ServerDiffStorage) {}

	async generateDiffResponse(
		request: ParsedRequest,
		previousResponseHash: string | undefined,
		currentResponseHash: string,
		currentResponse: string
	): Promise<string | undefined> {
		if (previousResponseHash === undefined) {
			return undefined;
		}

		const previousResponse = await this.storage.getResponse(request, previousResponseHash);

		await this.storage.setResponse(request, currentResponseHash, currentResponse);

		if (!previousResponse) {
			return undefined;
		}

		const diffed = diff.compute(previousResponse, currentResponse);
		const diffString = diff.encode(diffed);

		if (diffString.length >= currentResponse.length) return undefined;
		
		return diffString;
	}
}