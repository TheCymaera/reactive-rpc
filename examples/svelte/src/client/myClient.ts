import { Client, HTTPClient, IcebergHeaders, Serializer, SSEClient } from "@iceberg/core";
import { ReactiveSvelteClient } from "@iceberg/core/client-implementations/reactive-svelte-client";
import type { myProcedures } from "../server/myProcedures.js";
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

export const myClient = Client.create<typeof myProcedures>({
	implementation: reactiveClient,
});
