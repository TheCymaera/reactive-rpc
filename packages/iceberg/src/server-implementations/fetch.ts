import { IcebergHeaders, UserFacingError, type ParsedRequest } from "../core.js";
import type { ProcedureRegistry } from "../procedureServer.js";
import { SSEHub } from "../SSEHub.js";
import { JSONSerializer, Serializer } from "../Serializer.js";
import { DependencyTracker, type DependencyContext } from "../DependencyTracker.js";

export interface FetchHandlerOptions {
	procedures: ProcedureRegistry;
	serializer?: Serializer;
	hash?: (value: string) => Promise<string>;
	sseHub?: SSEHub;
	errorGuard?: (thrown: unknown) => UserFacingError;
}

const defaultErrorGuard = (thrown: unknown): UserFacingError => {
	if (thrown instanceof UserFacingError) return thrown;
	if (thrown instanceof Error) return new UserFacingError(500, "An internal error occurred.");
	return new UserFacingError(500, "Unknown error.");
};

async function defaultHash(value: string): Promise<string> {
	const data = new TextEncoder().encode(value);
	const buffer = await crypto.subtle.digest("SHA-256", data);
	const bytes = Array.from(new Uint8Array(buffer));
	return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function createFetchHandler(options: FetchHandlerOptions) {
	const errorGuard = options.errorGuard ?? defaultErrorGuard;
	const hashFunction = options.hash ?? defaultHash;

	return {
		fetch(request: Request) {
			return handleRequest(
				options,
				errorGuard,
				hashFunction,
				request
			);
		},
	};
}

async function handleRequest(
	options: FetchHandlerOptions,
	errorGuard: (thrown: unknown) => UserFacingError,
	hashFunction: (value: string) => Promise<string>,
	request: Request,
): Promise<Response> {
	const responseInit = {
		status: 200,
		headers: { "Content-Type": "text/plain" } as Record<string, string>,
	};

	try {
		const parsed = await parseRequest(request).catch((e) => {
			throw e instanceof UserFacingError ? e : new UserFacingError(400, "Invalid request body.");
		});

		const procedure = options.procedures[parsed.procedureName];
		if (!procedure) {
			throw new UserFacingError(404, `Unknown procedure: ${parsed.procedureName}`);
		}

		if (procedure.kind !== parsed.kind) {
			throw new UserFacingError(405, `Procedure ${parsed.procedureName} is not a ${parsed.kind}`);
		}

		const dependencyContext = { kind: procedure.kind, readSets: [], writeSets: [] } as DependencyContext;

		const result = await DependencyTracker.context.run(dependencyContext, async () => {
			const readSetsBefore = dependencyContext.readSets.length;
			const value = await procedure(parsed.input);
			const newReadSets = dependencyContext.readSets.slice(readSetsBefore);

			if (options.sseHub) {
				const sessionId = request.headers.get(IcebergHeaders.SESSION);

				if (sessionId) {
					if (parsed.kind === "query") {
						options.sseHub.subscribe(sessionId, parsed.procedureName, parsed.input, newReadSets);
					} else {
						options.sseHub.publish(dependencyContext.writeSets);
					}
				}
			}

			return value;
		});

		const responseBody = Serializer.primary.serialize(result);
		const hash = await hashFunction(responseBody);

		const clientHash = request.headers.get(IcebergHeaders.HASH);
		if (clientHash && clientHash === hash) {
			responseInit.headers[IcebergHeaders.HASH] = hash;
			return new Response(null, { ...responseInit, status: 304 });
		}

		responseInit.headers[IcebergHeaders.HASH] = hash;
		return new Response(responseBody, responseInit);
	} catch (error) {
		const userFacingError = errorGuard(error);
		responseInit.status = userFacingError.statusCode;
		return new Response(
			Serializer.primary.serialize({ error: userFacingError.message }),
			responseInit,
		);
	}
}

async function parseRequest(request: Request): Promise<ParsedRequest> {
	const url = new URL(request.url);
	const procedureName = decodeURIComponent(url.pathname.split("/").pop() ?? "");

	if (request.method === "GET") {
		const inputParam = url.searchParams.get("input");
		const input = inputParam === null ? undefined : Serializer.primary.deserialize(inputParam);
		return { procedureName, input, kind: "query" };
	}

	if (request.method === "POST") {
		const bodyText = await request.text();
		if (!bodyText) throw new UserFacingError(400, "Missing request body for POST request.");
		const body = Serializer.primary.deserialize(bodyText) as { input: unknown };
		return { procedureName, input: body.input, kind: "mutation" };
	}

	throw new UserFacingError(405, `Unsupported HTTP method: ${request.method}`);
}

export interface SSEFetchHandlerOptions {
	sseHub: SSEHub;
}

export function createSSEFetchHandler(options: SSEFetchHandlerOptions) {
	return {
		fetch(request: Request) {
			const url = new URL(request.url);

			const sessionId = url.searchParams.get("session");
			if (!sessionId) {
				return new Response("Missing session ID", { status: 400 });
			}
			return options.sseHub.createResponse(sessionId);
		},
	};
}
