import { IcebergHeaders, type ParsedRequest } from "../core.js";
import { diff } from "../diff-generators/diff.js";
import type { DiffGenerator } from "../diff-generators/DiffGenerator.js";
import type { ProcedureRegistry } from "../procedureServer.js";

export interface BunHandlerOptions {
	procedures: ProcedureRegistry;
	diffGenerator: DiffGenerator;
}

export function createBunHandler(options: BunHandlerOptions) {
	return {
		fetch(request: Request) {
			return handleRequest(options, request)
		}
	}
}

async function handleRequest(options: BunHandlerOptions, request: Request): Promise<Response> {
	const parsed = await parseRequest(request);
	
	const responseInit = {
		status: 200,
		headers: {
			'Content-Type': 'application/json'
		} as Record<string, string>,
	};
	
	try {
		const procedure = options.procedures[parsed.procedureName];
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

		const diffed = await options.diffGenerator.generateDiffResponse(
			parsed,
			lastRequestHash,
			hash,
			responseText.toString()
		);
		if (diffed !== undefined) {
			responseText = diffed;
			responseInit.headers['Content-Type'] = diff.EncodedMimeType;
			responseInit.headers[IcebergHeaders.IS_DIFF] = "true";
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

import { createHash } from "node:crypto";
async function hashString(string: string): Promise<string> {
	return createHash('md5').update(string).digest('hex');
}