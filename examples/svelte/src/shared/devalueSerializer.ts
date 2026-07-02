import type { Serializer } from "@iceberg/core";
import * as devalue from "devalue";

export const devalueSerializer: Serializer = {
	serialize: (value: unknown) => {
		return devalue.stringify(value);
	},
	deserialize: (raw: string) => {
		console.log("devalueSerializer.deserialize called with raw:", raw);
		return devalue.parse(raw);
	}
}