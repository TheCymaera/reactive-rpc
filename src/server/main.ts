import { createBunHandler } from "../lib/iceberg/server-implementations/bun.js";
import { InMemoryServerDiffStorage } from "../lib/iceberg/ServerDiffStorage.js";
import { requestContext } from "./currentRequest.js";
import { myProcedures } from "./myProcedures.js";

const icebergHandler = createBunHandler(
	myProcedures,
	new InMemoryServerDiffStorage()
);

const server = Bun.serve({
	port: 3000,
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