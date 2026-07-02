import { defaultReadSetRegistry, type ReadSetEntry, type WriteSetEntry } from "./ReadSetRegistry.js";
import { Serializer } from "./Serializer.js";

type Invalidation = { procedureName: string; input: unknown };

const STALE_PENDING_MS = 30_000;

interface Session {
	queries: Map<string, { procedureName: string; input: unknown; readSets: ReadSetEntry[] }>;
	controller: ReadableStreamDefaultController | undefined;
	interval: ReturnType<typeof setInterval> | undefined;
	createdAt: number;
}

function safeEnqueue(controller: ReadableStreamDefaultController | undefined, data: string): void {
	if (!controller) return;
	try { controller.enqueue(new TextEncoder().encode(data)); } catch { /* closed */ }
}

export class SSEHub {
	readonly #sessions = new Map<string, Session>();

	constructor() {
		setInterval(() => this.#cleanup(), STALE_PENDING_MS);
	}

	subscribe(
		sessionId: string,
		procedureName: string,
		input: unknown,
		readSets: ReadSetEntry[],
	): void {
		let session = this.#sessions.get(sessionId);
		if (!session) {
			session = { queries: new Map(), controller: undefined, interval: undefined, createdAt: Date.now() };
			this.#sessions.set(sessionId, session);
		}
		const key = `${procedureName}:${Serializer.primary.serialize(input)}`;
		session.queries.set(key, { procedureName, input, readSets });
	}

	publish(writeSets: WriteSetEntry[]): void {
		if (writeSets.length === 0) return;

		for (const [, session] of this.#sessions) {
			if (!session.controller) continue;

			const invalidated: Invalidation[] = [];
			for (const [, query] of session.queries) {
				if (defaultReadSetRegistry.matches(query.readSets, writeSets)) {
					invalidated.push({ procedureName: query.procedureName, input: query.input });
				}
			}
			for (let i = 0; i < invalidated.length; i++) {
				const inv = invalidated[i]!;
				safeEnqueue(
					session.controller,
					`event: invalidate\ndata: ${Serializer.primary.serialize(inv)}\n\n`,
				);
			}
		}
	}

	createResponse(sessionId: string): Response {
		const existing = this.#sessions.get(sessionId);

		if (existing?.controller) {
			try { existing.controller.error(); } catch { /* ignore */ }
		}
		if (existing?.interval) {
			clearInterval(existing.interval);
		}

		let interval: ReturnType<typeof setInterval> | undefined = undefined;
		const stream = new ReadableStream({
			start: (controller) => {
				interval = setInterval(() => {
					safeEnqueue(controller, ": heartbeat\n\n");
				}, 5_000);

				safeEnqueue(controller, ": heartbeat\n\n");

				this.#sessions.set(sessionId, {
					queries: existing?.queries ?? new Map(),
					controller,
					interval,
					createdAt: Date.now(),
				});
			},
			cancel: () => {
				clearInterval(interval);
				const s = this.#sessions.get(sessionId);
				if (s) s.controller = undefined;
			}
		});

		return new Response(stream, {
			headers: {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache",
				Connection: "keep-alive",
			},
		});
	}

	#cleanup(): void {
		const now = Date.now();
		for (const [id, session] of this.#sessions) {
			if (!session.controller && now - session.createdAt > STALE_PENDING_MS) {
				this.#sessions.delete(id);
			}
		}
	}
}