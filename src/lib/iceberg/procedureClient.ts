import type { ProcedureRegistry } from "./procedureServer.js";

export interface ClientImplementation {
	query(procedureName: string, input: unknown): Promise<{ result: unknown, dependencies: string[] }>;
	mutation(procedureName: string, input: unknown): Promise<{ result: unknown, dependencies: string[] }>;
}

export interface Client<T extends ProcedureRegistry> {
	queries: ProceduresToFunctions<ProceduresFilteredByKind<T, "query">>;
	mutations: ProceduresToFunctions<ProceduresFilteredByKind<T, "mutation">>;
}

export namespace Client {
	export const create = createClient;
}

type ProceduresToFunctions<Registry extends ProcedureRegistry> = {
	[Name in keyof Registry]: Registry[Name]["handler"];
}

type ProceduresFilteredByKind<Registry extends ProcedureRegistry, Kind extends "query" | "mutation"> = {
	[Name in keyof Registry as Registry[Name]['kind'] extends Kind ? Name : never]: Registry[Name];
}

function createClient<Procedures extends ProcedureRegistry>({ implementation } : { implementation: ClientImplementation }): Client<Procedures> {
	return new Proxy<Client<Procedures>>({} as any, {
		get<Name extends string>(_: unknown, prop: Name) {
			let kind: "query" | "mutation";
			if (prop === "queries") kind = "query";
			else if (prop === "mutations") kind = "mutation";
			else return undefined;

			return new Proxy({} as any, {
				get(_: unknown, procedureName: string) {
					return async (input: unknown) => {
						if (kind === "query") {
							return (await implementation.query(procedureName, input)).result;
						} else {
							return (await implementation.mutation(procedureName, input)).result;
						}
					};
				}
			});
		}
	})
}