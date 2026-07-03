import { createFetchHandler, createSSEFetchHandler } from "@iceberg/core/server-implementations/fetch";
import { SSEHub } from "@iceberg/core/sse-hub";
import { requestContext } from "./currentRequest.js";
import { myProcedures } from "./myProcedures.js";
import { Serializer } from "@iceberg/core/serializer";
import { devalueSerializer } from "../shared/devalueSerializer.js";

const sseHub = new SSEHub();

const sseHandler = createSSEFetchHandler({ sseHub });
const rpcHandler = createFetchHandler({ procedures: myProcedures, sseHub });

Serializer.primary = devalueSerializer;

const server = Bun.serve({
	port: 3000,
	idleTimeout: 0,
	fetch(request) {
		return requestContext.run(request, () => {
			const url = new URL(request.url);
			if (url.pathname.startsWith('/api/iceberg/sse')) {
				return sseHandler.fetch(request);
			}
			if (url.pathname.startsWith('/api/iceberg/')) {
				return rpcHandler.fetch(request);
			}
			return new Response("Not Found", { status: 404 });
		});
	}
});

console.log(`Server running at http://${server.hostname}:${server.port}/`);
