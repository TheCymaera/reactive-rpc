import { StandardSchemaV1 } from "@standard-schema/spec";
import { AsyncLocalStorage } from "async_hooks";


export function query<Arguments, Return>(
	input: StandardSchemaV1<Arguments>,
	handler: (input: Arguments) => Promise<Return>,
): Procedure<"query", Arguments, Return> {
	return createProcedure({ kind: "query", schema: input, handler: handler });
}

export function mutation<Arguments, Return>(
	input: StandardSchemaV1<Arguments>,
	handler: (input: Arguments) => Promise<Return>,
): Procedure<"mutation", Arguments, Return> {
	return createProcedure({ kind: "mutation", schema: input, handler: handler });
}

export type Procedure<Kind extends "query"|"mutation", Input, Output> = {
	readonly kind: Kind;
	readonly schema: StandardSchemaV1<Input>;
	readonly handler: (input: Input) => Promise<Output>;
} & ((input: unknown) => Promise<{ value: Output; dependencies: Set<string> }>);

export interface ProcedureRegistry {
	[key: string]: Procedure<"query"|"mutation", any, any>;
}

export class DependencyTracker {
	static readonly context = new AsyncLocalStorage<Set<string>>();

	static add(dependency: string): void {
		this.#current()?.add(dependency);
	}

	static get(): Set<string> {
		return new Set(this.#current() || []);
	}

	static #current(): Set<string> | undefined {
		return DependencyTracker.context.getStore();
	}

	static readonly track = dependencies;
}

export function dependencies<T extends Record<string, unknown>>(registry: T): T {
	return new Proxy(registry, {
		get(target, prop: string) {
			if (prop in target) DependencyTracker.add(prop);
			return target[prop];
		}
	});	
}

function createProcedure<Kind extends "query"|"mutation", Input, Output>(options: {
	kind: Kind;
	schema: StandardSchemaV1<Input>;
	handler: (input: Input) => Promise<Output>;
}): Procedure<Kind, Input, Output> {
	const proc = async (input: unknown): Promise<{ value: Output; dependencies: string[] }> => {
		return DependencyTracker.context.run(new Set<string>(), async () => {
			const validation = await options.schema["~standard"].validate(input);
			if (validation.issues) {
				throw new Error(`Invalid arguments for procedure.`);
			}

			const result = await options.handler(validation.value);
			const dependencies = Array.from(DependencyTracker.get());
			return { value: result, dependencies };
		});
	}
	proc.kind = options.kind;
	proc.schema = options.schema;
	proc.handler = options.handler;
	return proc as unknown as Procedure<Kind, Input, Output>;
}