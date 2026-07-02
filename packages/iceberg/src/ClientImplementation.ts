export interface ClientResponse {
	result: unknown;
}

export interface ClientImplementation {
	query(procedureName: string, input: unknown): Promise<ClientResponse>;
	mutation(procedureName: string, input: unknown): Promise<ClientResponse>;
}
