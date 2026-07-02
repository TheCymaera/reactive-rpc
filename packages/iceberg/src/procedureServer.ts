import type { StandardSchemaV1 } from "@standard-schema/spec";
import { InvalidProcedureArgumentsError } from "./core.js";
import { DependencyTracker } from "./DependencyTracker.js";

export function query<Arguments, Return>(
	schema: StandardSchemaV1<Arguments>,
	handler: (input: Arguments) => Promise<Return>,
): Procedure<"query", Arguments, Return> {
	return createProcedure({ kind: "query", schema, handler });
}

export function mutation<Arguments, Return>(
	schema: StandardSchemaV1<Arguments>,
	handler: (input: Arguments) => Promise<Return>,
): Procedure<"mutation", Arguments, Return> {
	return createProcedure({ kind: "mutation", schema, handler });
}

export type Procedure<Kind extends "query" | "mutation", Input, Output> = {
	readonly kind: Kind;
	readonly schema: StandardSchemaV1<Input>;
	readonly handler: (input: Input) => Promise<Output>;
} & ((input: unknown) => Promise<Output>);

export interface ProcedureRegistry {
	[key: string]: Procedure<"query" | "mutation", any, any>;
}

function createProcedure<Kind extends "query" | "mutation", Input, Output>(options: {
	kind: Kind;
	schema: StandardSchemaV1<Input>;
	handler: (input: Input) => Promise<Output>;
}): Procedure<Kind, Input, Output> {
	const proc = async (input: unknown): Promise<Output> => {
		const validation = await options.schema["~standard"].validate(input);
		if (validation.issues) {
			throw new InvalidProcedureArgumentsError(validation.issues);
		}

		return options.handler(validation.value);
	};
	proc.kind = options.kind;
	proc.schema = options.schema;
	proc.handler = options.handler;
	return proc as unknown as Procedure<Kind, Input, Output>;
}