import { AsyncLocalStorage } from "async_hooks";

export const requestContext = new AsyncLocalStorage<Request>();

export function currentRequest() {
	const store = requestContext.getStore();
	if (!store) throw new Error("No current request available");
	return store;
}