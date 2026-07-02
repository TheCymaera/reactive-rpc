import { exactMatch } from "./read-set-implementations/exactMatch.js";

export type ReadSetEntry = { implementation: string; readPayload: unknown };
export type WriteSetEntry = { implementation: string; writePayload: unknown };

export interface ReadSetImplementation<R, W> {
	id: string;
	match(readPayload: R, writePayload: W): boolean;
}

export class ReadSetRegistry {
	readonly #implementations = new Map<string, ReadSetImplementation<unknown, unknown>>();

	register<R, W>(matcher: ReadSetImplementation<R, W>): void {
		if (this.#implementations.has(matcher.id)) {
			throw new Error(`Read set implementation "${matcher.id}" is already registered.`);
		}
		this.#implementations.set(matcher.id, matcher);
	}

	unregister(implementation: string): void {
		this.#implementations.delete(implementation);
	}

	matches(
		readSets: readonly ReadSetEntry[],
		writeSets: readonly WriteSetEntry[],
	): boolean {
		return readSets.some(readSet => {
			const impl = this.#implementations.get(readSet.implementation);
			if (!impl) {
				console.warn(`Unknown read set implementation "${readSet.implementation}". Did you forget to register it?`);
				return false;
			}
			return writeSets.some(writeSet => {
				if (writeSet.implementation !== readSet.implementation) return false;
				return impl.match(readSet.readPayload, writeSet.writePayload);
			});
		});
	}
}

export const defaultReadSetRegistry = new ReadSetRegistry();
defaultReadSetRegistry.register(exactMatch);