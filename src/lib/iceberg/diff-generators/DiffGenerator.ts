import type { ParsedRequest } from "../core.js";

export interface DiffGenerator {
	generateDiffResponse(
		request: ParsedRequest,
		previousResponseHash: string | undefined,
		currentResponseHash: string,
		currentResponse: string
	): Promise<string | undefined>;
}