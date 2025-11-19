export namespace IcebergHeaders {
	export const DEPENDENCIES = 'X-Iceberg-Dependencies';
	export const DIFFING_HASH = 'X-Iceberg-Hash';
}

export type ParsedRequest = {
	kind: 'query' | 'mutation';
	procedureName: string;
	input: unknown;
};