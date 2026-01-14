import { HTTPClient } from "../lib/iceberg/client-implementations/HTTPClient.js";
import { Client } from "../lib/iceberg/procedureClient.js";
import type { myProcedures } from "../server/myProcedures.js";
import { ReactiveSvelteClient } from "../lib/iceberg/client-implementations/ReactiveSvelteClient.svelte.js";

export const myClient = Client.create<typeof myProcedures>({
	implementation: new ReactiveSvelteClient({
		inner: new HTTPClient({
			url: `${location.origin}/api/iceberg`,
			headers: {
				'Authorization': new URL(location.href).searchParams.get('user') || '',
			},
		}),
	}),
})