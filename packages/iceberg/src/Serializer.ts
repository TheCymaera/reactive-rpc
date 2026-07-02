export interface Serializer {
	serialize(value: unknown): string;
	deserialize(raw: string): unknown;
}

export const JSONSerializer: Serializer = {
	serialize: JSON.stringify,
	deserialize: JSON.parse,
};

export const Serializer = {
	primary: JSONSerializer,
}