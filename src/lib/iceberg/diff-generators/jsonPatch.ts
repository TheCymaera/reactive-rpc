import { compare, applyPatch, type Operation } from "fast-json-patch";

export type JSONPatch = Operation[];

export function createJsonPatch(from: unknown, to: unknown) {
	return compare({ data: from }, { data: to });
}

export function applyJsonPatch<T>(data: T, patch: Operation[]): T {
	const result = applyPatch({ data }, patch, false, false).newDocument;
	return result.data;
}