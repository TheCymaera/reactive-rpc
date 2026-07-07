import { Client, HTTPClient, IcebergHeaders, Serializer, SSEClient } from "@iceberg/core";
import { ReactiveSvelteClient } from "@iceberg/core/client-implementations/reactive-svelte-client";
import { devalueSerializer } from "../shared/devalueSerializer.js";

Serializer.primary = devalueSerializer;

const user = new URL(location.href).searchParams.get("user") || "";
const sessionId = crypto.randomUUID();

const reactiveClient = new ReactiveSvelteClient({
	inner: new HTTPClient({
		url: `${location.origin}/api/iceberg`,
		sessionId,
		headers: {
			'Authorization': user,
		},
	}),
});

const sse = new SSEClient({
	url: `${location.origin}/api/iceberg/sse?session=${encodeURIComponent(sessionId)}`,
});
sse.onInvalidate(({ procedureName, input }) => {
	reactiveClient.invalidate(procedureName, input);
});

/**
 * The iceberg client instance.
 *
 * When a `.iceberg.ts` file is imported on the client side, the Vite plugin
 * replaces it with a proxy module that re-exports each procedure as a direct
 * call through this client. Example generated code:
 *
 *   import { myClient } from "./myClient.js";
 *   export const getPosts = client.queries["getPosts"];
 *   export const createPost = client.mutations["createPost"];
 */
export const myClient = Client.create({
	implementation: reactiveClient,
});
