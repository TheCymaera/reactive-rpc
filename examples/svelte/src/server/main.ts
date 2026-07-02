import { createBunHandler } from "@iceberg/core/server-implementations/bun";
import { SSEHub } from "@iceberg/core/sse-hub";
import { requestContext } from "./currentRequest.js";
import { myProcedures } from "./myProcedures.js";
import { Serializer } from "@iceberg/core/serializer";
import { devalueSerializer } from "../shared/devalueSerializer.js";

const icebergHandler = createBunHandler({
	procedures: myProcedures,
	sseHub: new SSEHub(),
});

Serializer.primary = devalueSerializer;

const server = Bun.serve({
	port: 3000,
	idleTimeout: 0,
	fetch(request) {
		return requestContext.run(request, () => {
			const url = new URL(request.url);
			if (url.pathname.startsWith('/api/iceberg/')) {
				return icebergHandler.fetch(request);
			}
			return new Response("Not Found", { status: 404 });
		});
	}
});

console.log(`Server running at http://${server.hostname}:${server.port}/`);
