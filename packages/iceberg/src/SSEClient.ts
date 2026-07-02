import { Serializer } from "./Serializer.js";

export class SSEClient {
	readonly #url: string;
	#eventSource: EventSource | undefined = undefined;
	#onInvalidate: ((event: { procedureName: string; input: unknown }) => void)[] = [];
	#reconnectTimer: ReturnType<typeof setTimeout> | undefined = undefined;

	constructor(options: { url: string }) {
		this.#url = options.url;
		this.reconnect();
	}

	reconnect(): void {
		if (this.#reconnectTimer) {
			clearTimeout(this.#reconnectTimer);
			this.#reconnectTimer = undefined;
		}

		this.#eventSource?.close();
		this.#eventSource = new EventSource(this.#url);

		this.#eventSource.addEventListener("invalidate", (event: MessageEvent) => {
			const data = Serializer.primary.deserialize(event.data) as { procedureName: string; input: unknown };
			for (const callback of this.#onInvalidate) {
				callback(data);
			}
		});

		this.#eventSource.addEventListener("error", () => {
			this.#eventSource?.close();
			if (this.#onInvalidate) {
				this.#reconnectTimer = setTimeout(() => this.reconnect(), 2000);
			}
		});
	}

	[Symbol.dispose](): void {
		if (this.#reconnectTimer) {
			clearTimeout(this.#reconnectTimer);
			this.#reconnectTimer = undefined;
		}
		this.#eventSource?.close();
		this.#eventSource = undefined;
	}

	onInvalidate(callback: (event: { procedureName: string; input: unknown }) => void) {
		this.#onInvalidate.push(callback);
		return { [Symbol.dispose]: () => {
			const index = this.#onInvalidate.indexOf(callback);
			if (index !== -1) {
				this.#onInvalidate.splice(index, 1);
			}
		}};
	}
}