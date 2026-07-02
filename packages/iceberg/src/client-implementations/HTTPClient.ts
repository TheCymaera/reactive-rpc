import { IcebergHeaders, UserFacingError } from "../core.js";
import type { ClientImplementation, ClientResponse } from "../ClientImplementation.js";
import { JSONSerializer, Serializer } from "../Serializer.js";

export class HTTPClient implements ClientImplementation {
	readonly url: string;
	#cached = new Map<string, { hash: string; result: unknown }>();

	constructor(private options: {
		url: string;
		sessionId?: string;
		headers?: Record<string, string>
	}) {
		this.url = options.url;
	}

	async query(procedureName: string, input: unknown): Promise<ClientResponse> {
		const base = this.url.endsWith("/") ? this.url.slice(0, -1) : this.url;
		const url = new URL(`${base}/${encodeURIComponent(procedureName)}`);
		if (input !== undefined) {
			url.searchParams.append("input", Serializer.primary.serialize(input));
		}

		const cacheKey = `${procedureName}:${Serializer.primary.serialize(input)}`;
		const cached = this.#cached.get(cacheKey);

		const response = await fetch(url.toString(), {
			method: "GET",
			headers: {
				...this.#headers(),
				[IcebergHeaders.HASH]: cached?.hash ?? "",
			},
		});

		return this.#processResponse(cacheKey, response);
	}

	async mutation(procedureName: string, input: unknown): Promise<ClientResponse> {
		const base = this.url.endsWith("/") ? this.url.slice(0, -1) : this.url;
		const url = new URL(`${base}/${encodeURIComponent(procedureName)}`);

		const response = await fetch(url.toString(), {
			method: "POST",
			headers: {
				...this.#headers(),
			},
			body: Serializer.primary.serialize({ input }),
		});

		return this.#processResponse(undefined, response);
	}

	#headers() {
		const headers = { ...this.options.headers };
		if (this.options.sessionId) {
			headers[IcebergHeaders.SESSION] = this.options.sessionId;
		}
		return headers;
	}

	async #processResponse(cacheKey: string | undefined, response: Response): Promise<ClientResponse> {
		const newHash = response.headers.get(IcebergHeaders.HASH) ?? "";

		if (response.status === 304) {
			const cached = cacheKey ? this.#cached.get(cacheKey) : undefined;
			if (cached) {
				return { result: cached.result };
			}
			return { result: undefined };
		}

		let body: string;
		try {
			body = await response.text();
		} catch {
			throw new UserFacingError(500, "Failed to read response body.");
		}

		if (!response.ok) {
			let message = `Request failed with status ${response.status}`;
			try {
				const parsed = Serializer.primary.deserialize(body) as { error?: string };
				message = parsed.error ?? message;
			} catch { /* ignore */ }
			throw new UserFacingError(response.status, message);
		}

		const result = Serializer.primary.deserialize(body);

		if (cacheKey) {
			this.#cached.set(cacheKey, { hash: newHash, result });
		}

		return { result };
	}
}