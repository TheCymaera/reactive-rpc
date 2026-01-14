import type { ParsedRequest } from "../core.js";
import type { DiffGenerator } from "./DiffGenerator.js";
import type { JSONPatch } from "./jsonPatch.js";

export class BasicDiffGenerator implements DiffGenerator {
	async generateDiffResponse(
		request: ParsedRequest,
		previousResponseHash: string | undefined,
		currentResponseHash: string,
		currentResponse: unknown
	): Promise<JSONPatch | undefined> {
		if (previousResponseHash === currentResponseHash) {
			return [];
		}
		return undefined;
	}
}