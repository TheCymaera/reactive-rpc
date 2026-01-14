import { IcebergHeaders, UserFacingError, type ParsedRequest } from "../core.js";
import { type ClientDiffStorage, InMemoryClientDiffStorage } from "../ClientDiffStorage.js";
import type { ClientImplementation } from "../procedureClient.js";
import { applyJsonPatch, type JSONPatch } from "../diff-generators/jsonPatch.js";
import { Transformer } from "../../open-utilities/Transformer.js";

export class HTTPClient implements ClientImplementation {
	readonly url: string;
	readonly headers: Record<string, string>;
	readonly diffStorage = new InMemoryClientDiffStorage();
	constructor(options: { url: string, headers?: Record<string, string> }) {
		this.url = options.url;
		this.headers = options.headers || {};
	}

	async query(procedureName: string, input: unknown) {
		const url = new URL(this.url);
		url.pathname += `/${encodeURIComponent(procedureName)}`;
		if (input !== undefined) {
			url.searchParams.append('input', JSON.stringify(input));
		}

		const request = { kind: 'query' as const, procedureName, input };

		const previousResponse = await this.diffStorage.getResponse(request);

		const response = await fetch(url.toString(), {
			method: 'GET',
			headers: {
				...this.headers,
				[IcebergHeaders.DIFFING_HASH]: previousResponse?.hash || "",
			}
		});

		return this.#processResponse(request, previousResponse, response);
	}

	async mutation(procedureName: string, input: unknown) {
		const url = new URL(this.url);
		url.pathname += `/${encodeURIComponent(procedureName)}`;

		const response = await fetch(url.toString(), {
			method: 'POST',
			headers: {
				...this.headers,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ input }),
		});

		return this.#processResponse(
			{ kind: 'mutation', procedureName, input },
			undefined,
			response
		);
	}

	async #processResponse(
		request: ParsedRequest,
		previousResponse: { hash: string, response: unknown } | undefined,
		response: Response
	) {
		const dependenciesRaw = response.headers.get(IcebergHeaders.DEPENDENCIES) || "[]";
		const dependencies = JSON.parse(dependenciesRaw);

		const newHash = response.headers.get(IcebergHeaders.DIFFING_HASH)!;
		const isDiff = response.headers.get(IcebergHeaders.IS_DIFF) === "true";

		let responseParsed: unknown;
		try {
			responseParsed = await response.json();
		} catch {
			throw new UserFacingError(500, "Failed to parse server response as JSON.");
		}

		if (!response.ok) {
			const message = (responseParsed as { error?: string })?.error || `Request failed with status ${response.status}`;
			throw new UserFacingError(response.status, message);
		}

		const unsanitizedResult = await processDiff(
			this.diffStorage,
			previousResponse,
			request,
			isDiff,
			newHash,
			responseParsed
		);

		const result = Transformer.defaultJson.unTransform(unsanitizedResult);

		return {
			result,
			dependencies: dependencies,
		}
	}
}

async function processDiff(
	storage: ClientDiffStorage,
	previousResponse: { hash: string, response: unknown } | undefined,
	request: ParsedRequest,
	isDiff: boolean,
	hash: string,
	result: unknown
): Promise<unknown> {
	if (previousResponse && isDiff) {
		result = applyJsonPatch(previousResponse.response, result as JSONPatch);
	}

	storage.setResponse(request, { hash, response: result });

	return result;
}