import type { ClientImplementation, ClientResponse } from "../ClientImplementation.js";
import { createSubscriber } from "svelte/reactivity";
import { Serializer } from "../Serializer.js";

export class ReactiveSvelteClient implements ClientImplementation {
	readonly inner: ClientImplementation;
	readonly #trackedList: Record<string, Tracked> = $state.raw({});

	constructor(options: { inner: ClientImplementation }) {
		this.inner = options.inner;
	}

	async query(procedureName: string, input: unknown): Promise<ClientResponse> {
		const key = this.#key(procedureName, input);

		const tracked = (this.#trackedList[key] ??= new Tracked(() => {
			return this.inner.query(procedureName, input);
		}, () => {
			delete this.#trackedList[key];
		}));

		return tracked.promise;
	}

	async mutation(procedureName: string, input: unknown): Promise<ClientResponse> {
		return this.inner.mutation(procedureName, input);
	}

	invalidate(procedureName: string, input: unknown): void {
		const key = this.#key(procedureName, input);
		const tracked = this.#trackedList[key];
		if (tracked) tracked.refresh();
	}

	#key(procedureName: string, input: unknown) {
		return `${procedureName}(${Serializer.primary.serialize(input)})`;
	}
}

class Tracked {
	get promise(): Promise<ClientResponse> {
		this.#subscribe();
		return this.#promise;
	}

	refresh: () => void = () => {};

	constructor(query: () => Promise<ClientResponse>, cleanup: () => void) {
		this.#promise = query();
		this.#subscribe = createSubscriber(update => {
			this.refresh = () => {
				this.#promise = query();
				update();
			};
			return cleanup;
		});
	}

	#promise: Promise<ClientResponse> = undefined!;
	#subscribe: () => void = () => {};
}