declare module "virtual:iceberg-procedures" {
	import type { ProcedureRegistry } from "@iceberg/core/procedure-server";
	export const procedures: ProcedureRegistry;
}