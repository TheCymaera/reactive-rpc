import type { Serializer } from "@iceberg/core";
import * as devalue from "devalue";

export const devalueSerializer: Serializer = {
	serialize: (value: unknown) => {
		return devalue.stringify(value);
	},
	deserialize: (raw: string) => {
		return devalue.parse(raw);
	}
}