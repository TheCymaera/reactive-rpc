import { IcebergHeaders, type ParsedRequest } from "../core.js";
import { type ClientDiffStorage, InMemoryClientDiffStorage } from "../ClientDiffStorage.js";
import { diff } from "../diff-generators/diff.js";
import type { ClientImplementation } from "../procedureClient.js";

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
		previousResponse: { hash: string, response: string } | undefined,
		response: Response
	) {
		const dependenciesRaw = response.headers.get(IcebergHeaders.DEPENDENCIES) || "[]";
		const dependencies = JSON.parse(dependenciesRaw);

		const newHash = response.headers.get(IcebergHeaders.DIFFING_HASH)!;
		const isDiff = response.headers.get(IcebergHeaders.IS_DIFF) === "true";

		const text = await processDiff(
			this.diffStorage,
			previousResponse,
			request,
			isDiff,
			newHash,
			response
		);
		
		const json = JSON.parse(text);

		if (!response.ok) {
			const message = json?.error || `Request failed with status ${response.status}`;
			throw new FetchError(message, response.status);
		}


		return {
			result: json,
			dependencies: dependencies,
		}
	}
}

export class FetchError extends Error {
	constructor(message: string, public status: number) {
		super(message);
	}
}

async function processDiff(
	storage: ClientDiffStorage,
	previousResponse: { hash: string, response: string } | undefined,
	request: ParsedRequest,
	isDiff: boolean,
	hash: string,
	response: Response
): Promise<string> {
	let text: string;
	if (previousResponse && isDiff) {
		const raw = await response.text();
		const parsed = diff.decode(raw)
		text = diff.apply(previousResponse.response, parsed);
	} else {
		text = await response.text();
	}

	storage.setResponse(request, { hash, response: text });

	return text;
}