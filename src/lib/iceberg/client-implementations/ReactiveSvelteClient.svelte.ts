import { ClientImplementation } from "../procedureClient.js";

export class ReactiveSvelteClient implements ClientImplementation {
	readonly inner: ClientImplementation;
	readonly subscribedDependencies = new Set<string>();
	constructor(options: { 
		inner: ClientImplementation,
	}) {
		this.inner = options.inner;
	}

	async query(procedureName: string, input: unknown) {
		const key = this.#key(procedureName, input);
		console.log(`Querying ${key}`)

		// trigger reactivity
		this.#trackerInc[key];
		
		const result = await this.inner.query(procedureName, input);

		// store dependencies so we can invalidate this query later
		this.#trackerDependencies[key] = result.dependencies;

		return result;
	}

	async mutation(procedureName: string, input: unknown) {
		const result = await this.inner.mutation(procedureName, input);
		this.#invalidate(result.dependencies);
		return result;
	}

	#key(procedureName: string, input: unknown) {
		return `${procedureName}(${JSON.stringify(input)})`;
	}

	#trackerDependencies: Record<string, string[]> = $state.raw({});
	#trackerInc: Record<string, number> = $state({});

	#invalidate(dependencies: string[]) {
		for (const [key, deps] of Object.entries(this.#trackerDependencies)) {
			const isRelated = dependencies.some(dep => deps.includes(dep));
			if (!isRelated) continue;

			// increment to trigger effect
			this.#trackerInc[key] = (this.#trackerInc[key] || 0) + 1;
		}
	}
}
