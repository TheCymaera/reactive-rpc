import type { ParsedRequest } from "../core.js";
import { diff } from "./diff.js";
import type { DiffGenerator } from "./DiffGenerator.js";

export class BasicDiffGenerator implements DiffGenerator {
	async generateDiffResponse(
		request: ParsedRequest,
		previousResponseHash: string | undefined,
		currentResponseHash: string,
		currentResponse: string
	): Promise<string | undefined> {
		if (previousResponseHash === currentResponseHash) {
			return diff.empty();
		}
		return undefined;
	}
}