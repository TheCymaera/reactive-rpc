import { Transformer } from "../../open-utilities/Transformer.js";
import { IcebergHeaders, UserFacingError, type ParsedRequest } from "../core.js";
import type { DiffGenerator } from "../diff-generators/DiffGenerator.js";
import type { ProcedureRegistry } from "../procedureServer.js";

export interface BunHandlerOptions {
	procedures: ProcedureRegistry;
	diffGenerator: DiffGenerator;
	errorGuard?: (thrown: unknown) => UserFacingError;
}

export function createBunHandler(options: BunHandlerOptions) {
	return {
		fetch(request: Request) {
			return handleRequest(options, request)
		}
	}
}

async function handleRequest(options: BunHandlerOptions, request: Request): Promise<Response> {
	options.errorGuard ??= (thrown: unknown) => {
		if (thrown instanceof UserFacingError) {
			return thrown;
		} else if (thrown instanceof Error) {
			return new UserFacingError(500, 'An internal error occurred.');
		} else {
			return new UserFacingError(500, 'Unknown error.');
		}
	}
	
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

		const unsanitizedResult = await procedure(parsed.input);

		const result = { 
			value: Transformer.defaultJson.transform(unsanitizedResult.value),
			dependencies: unsanitizedResult.dependencies
		};

		responseInit.headers[IcebergHeaders.DEPENDENCIES] = JSON.stringify([...result.dependencies]);

		const lastRequestHash = request.headers.get(IcebergHeaders.DIFFING_HASH) || undefined;

		const responseJson = JSON.stringify(result.value);
		const hash = await hashString(responseJson);
		responseInit.headers[IcebergHeaders.DIFFING_HASH] = hash;

		const patch = await options.diffGenerator.generateDiffResponse(
			parsed,
			lastRequestHash,
			hash,
			result.value
		);

		let responseBody: string;
		if (patch !== undefined) {
			responseBody = JSON.stringify(patch);
			responseInit.headers[IcebergHeaders.IS_DIFF] = "true";
		} else {
			responseBody = responseJson;
		}

		return new Response(responseBody, responseInit);
	} catch (error) {
		const userFacingError = options.errorGuard(error);

		responseInit.status = userFacingError.statusCode;

		const result = { error: userFacingError.message };

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