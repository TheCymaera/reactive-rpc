import type { ClientImplementation } from "../procedureClient.js";
import { createSubscriber } from 'svelte/reactivity';

export class ReactiveSvelteClient implements ClientImplementation {
	readonly inner: ClientImplementation;
	constructor(options: { 
		inner: ClientImplementation,
	}) {
		this.inner = options.inner;
	}

	async query(procedureName: string, input: unknown) {
		const key = this.#key(procedureName, input);
		
		const tracked = this.#trackedList[key] ??= new Tracked(() => {
			console.log(`Sending request for ${key}`);
			return this.inner.query(procedureName, input);
		}, () => {
			console.log(`Un-tracking ${key}`);
			delete this.#trackedList[key];
		});

		return tracked.promise;
	}

	async mutation(procedureName: string, input: unknown) {
		const result = await this.inner.mutation(procedureName, input);
		this.#refresh(result.dependencies);
		return result;
	}

	#key(procedureName: string, input: unknown) {
		return `${procedureName}(${JSON.stringify(input)})`;
	}

	#trackedList: Record<string, Tracked> = $state.raw({});

	async #refresh(dependencies: string[]) {
		for (const [_, tracked] of Object.entries(this.#trackedList)) (async ()=>{
			const result = await tracked.promise;
			const deps = result.dependencies;

			const isRelated = dependencies.some(dep => deps.includes(dep));
			if (!isRelated) return;

			tracked.refresh();
		})();
	}
}

class Tracked {
	get promise() {
		this.#subscribe();
		return this.#promise;
	}

	refresh() {
		// will be replaced in constructor
	}

	constructor(
		public query: ()=>Promise<{ dependencies: string[], result: unknown }>,
		cleanup: ()=>void,
	) {
		this.#promise = this.query();
		this.#subscribe = createSubscriber(update => {

			this.refresh = () => {
				this.#promise = this.query();
				update();
			}

			return cleanup;
		});
	}

	#promise: Promise<{ dependencies: string[], result: unknown }>;
	#subscribe: ()=>void;
}
