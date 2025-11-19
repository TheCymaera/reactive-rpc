import { IcebergHeaders, ParsedRequest } from "../core.js";
import { diff } from "../diff.js";
import { ServerDiffStorage } from "../ServerDiffStorage.js";
import { ProcedureRegistry } from "../procedureServer.js";

export function createBunHandler(procedures: ProcedureRegistry, diffStorage: ServerDiffStorage) {
	return {
		fetch(request: Request) {
			return handleRequest(procedures, request, diffStorage)
		}
	}
}

async function handleRequest(procedures: ProcedureRegistry, request: Request, diffStorage: ServerDiffStorage): Promise<Response> {
	const parsed = await parseRequest(request);
	
	const responseInit = {
		status: 200,
		headers: {
			'Content-Type': 'application/json'
		} as Record<string, string>,
	};
	
	try {
		const procedure = procedures[parsed.procedureName];
		if (!procedure) {
			throw new Error(`Unknown procedure: ${parsed.procedureName}`);
		}

		if (procedure.kind !== parsed.kind) {
			throw new Error(`Procedure ${parsed.procedureName} is not a ${parsed.kind}`);
		}

		const result = await procedure(parsed.input);

		responseInit.headers[IcebergHeaders.DEPENDENCIES] = JSON.stringify([...result.dependencies]);

		const lastRequestHash = request.headers.get(IcebergHeaders.DIFFING_HASH) || undefined;

		let responseText: BodyInit = JSON.stringify(result.value);


		const hash = await hashString(responseText);
		responseInit.headers[IcebergHeaders.DIFFING_HASH] = hash;

		const diffed = await generateDiffResponse(diffStorage, parsed, lastRequestHash, hash, responseText);
		if (diffed !== undefined) {
			// @ts-expect-error Wrong types
			responseText = diffed;
			responseInit.headers['Content-Type'] = diff.EncodedMimeType;
		}

		return new Response(responseText, responseInit);
	} catch (error) {
		const result = { error: (error as Error).message };

		responseInit.status = 400;
		return new Response(JSON.stringify(result), responseInit);
	}
}

async function parseRequest(request: Request): Promise<ParsedRequest> {
	const url = new URL(request.url);
	const procedureName = decodeURIComponent(url.pathname.split('/').pop() || '');

	if (request.method === 'GET') {
		const inputParam = url.searchParams.get('input');
		const input = inputParam === null ? undefined : JSON.parse(inputParam);
		return { procedureName, input, kind: "query" };
	}
	
	if (request.method === 'POST') {
		const body = await request.json();
		return { procedureName, input: body.input, kind: "mutation" };
	}
	
	throw new Error(`Unsupported HTTP method: ${request.method}`);
}


async function generateDiffResponse(
	storage: ServerDiffStorage,
	request: ParsedRequest,
	lastHash: string | undefined,
	hash: string,
	response: string
) {
	// don't diff mutations
	if (request.kind === 'mutation') return

	// store response
	storage.setResponse(request, hash, response);

	// get last response
	if (!lastHash) return

	const lastResponse = await storage.getResponse(request, lastHash);
	if (!lastResponse) return

	const diffs = diff.compute(lastResponse, response);
	const diffsString = diff.encode(diffs);
	
	if (diffsString.length >= response.length) return

	return diffsString
}

import { createHash } from "node:crypto";
async function hashString(string: string): Promise<string> {
	return createHash('md5').update(string).digest('hex');
}