import { AsyncLocalStorage } from "async_hooks";
import type { ReadSetEntry, WriteSetEntry } from "./ReadSetRegistry.js";

export interface DependencyContext {
	kind: "query" | "mutation";
	readSets: ReadSetEntry[];
	writeSets: WriteSetEntry[];
}

export class DependencyTracker {
	static readonly context = new AsyncLocalStorage<DependencyContext>();

	static addReadSet(implementation: string, payload: unknown): void {
		const ctx = this.#current();
		if (!ctx) return;
		ctx.readSets.push({ implementation, readPayload: payload });
	}

	static addWriteSet(implementation: string, payload: unknown): void {
		const ctx = this.#current();
		if (!ctx) return;
		ctx.writeSets.push({ implementation, writePayload: payload });
	}

	static getReadSets(): readonly ReadSetEntry[] {
		return this.#current()?.readSets ?? [];
	}

	static getWriteSets(): readonly WriteSetEntry[] {
		return this.#current()?.writeSets ?? [];
	}

	static #current(): DependencyContext | undefined {
		return DependencyTracker.context.getStore();
	}
}