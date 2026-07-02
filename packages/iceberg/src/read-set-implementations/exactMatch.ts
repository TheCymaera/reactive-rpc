import { DependencyTracker } from "../DependencyTracker.js";
import type { ReadSetImplementation } from "../ReadSetRegistry.js";

export const exactMatch: ReadSetImplementation<string, string> = {
	id: "exact-match",
	match(readPayload: string, writePayload: string): boolean {
		return readPayload === writePayload;
	},
}

export function trackRecord<T extends Record<string, unknown>>(registry: T): T {
	return new Proxy(registry, {
		get(target, prop: string) {
			if (!Object.hasOwn(target, prop)) return Reflect.get(target, prop, registry);

			const ctx = DependencyTracker.context.getStore();
			DependencyTracker.addReadSet("exact-match", prop);
			if (ctx?.kind === "mutation") {
				DependencyTracker.addWriteSet("exact-match", prop);
			}

			return target[prop];
		},
		has(target, prop: string) {
			const own = Object.hasOwn(target, prop);
			if (!own) return Reflect.has(target, prop);

			const ctx = DependencyTracker.context.getStore();
			DependencyTracker.addReadSet("exact-match", prop);
			if (ctx?.kind === "mutation") {
				DependencyTracker.addWriteSet("exact-match", prop);
			}

			return true;
		},
	});
}