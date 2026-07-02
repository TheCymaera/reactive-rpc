import type { StandardSchemaV1 } from "@standard-schema/spec";

export namespace IcebergHeaders {
	export const HASH = 'ETag';
	export const SESSION = 'X-Iceberg-Session';
}

export type ParsedRequest = {
	kind: 'query' | 'mutation';
	procedureName: string;
	input: unknown;
};

export class UserFacingError extends Error {
	constructor(readonly statusCode: number, message: string) {
		super(message);
	}
}

/**
 * By default, validation issues are not exposed to the user.
 * Use the errorGuard to expose details if desired.
 */
export class InvalidProcedureArgumentsError extends UserFacingError {
	constructor(readonly issues: readonly StandardSchemaV1.Issue[]) {
		super(400, `Invalid procedure arguments`);
	}
}