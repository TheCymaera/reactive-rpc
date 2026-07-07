import * as fs from "node:fs/promises";
import path from "node:path";
import type { Plugin } from "vite";

const CLIENT_PROXY_PREFIX = "\0iceberg-client-proxy:";
const VIRTUAL_ICEBERG_PROCEDURES = "virtual:iceberg-procedures";
const RESOLVED_VIRTUAL_ICEBERG_PROCEDURES = "\0" + VIRTUAL_ICEBERG_PROCEDURES;

export interface IcebergRemoteProceduresOptions {
	/**
	 * The string to prepend to each proxy module, which provides the client instance to use for remote procedure calls.
	 * Example: `import { myClient as client } from "/src/client/myClient.js";`
	 */
	proxyPrefix: string;
	/**
	 * The root directory to scan for `.iceberg.ts` files.
	 * Defaults to `process.cwd() + "/src"`.
	 */
	srcDir?: string;
}

export function icebergRemoteProcedures(options: IcebergRemoteProceduresOptions): Plugin<any>[] {
	return [
		icebergRemoteProceduresClient(options),
		icebergRemoteProceduresBackend(options),
	];
}

function icebergRemoteProceduresClient(options: IcebergRemoteProceduresOptions): Plugin<any> {
	return {
		name: "iceberg-remote-procedures",
		enforce: "pre",

		async resolveId(source: string, importer: string | undefined, resolveOptions: { ssr?: boolean }) {
			if (source.startsWith(CLIENT_PROXY_PREFIX)) return source;
			if (resolveOptions.ssr) return null;

			const isIcebergImport = source.endsWith(".iceberg.ts") || source.endsWith(".iceberg.js");
			if (!isIcebergImport) return null;

			const resolved = await this.resolve(source, importer, {
				...resolveOptions,
				skipSelf: true,
			});

			if (!resolved?.id.endsWith(".iceberg.ts")) return null;
			return CLIENT_PROXY_PREFIX + resolved.id;
		},

		async load(id: string) {
			if (!id.startsWith(CLIENT_PROXY_PREFIX)) return null;

			const sourceId = id.slice(CLIENT_PROXY_PREFIX.length);
			const sourceText = await fs.readFile(sourceId, "utf8");
			const exportNames = extractExportNames(sourceText);

			return createClientProxyModule(exportNames, options);
		},
	};
}

function icebergRemoteProceduresBackend(options: IcebergRemoteProceduresOptions): Plugin<any> {
	const srcDir = path.resolve(process.cwd(), options.srcDir ?? "src");

	return {
		name: "iceberg-backend-procedures",
		resolveId(id: string) {
			if (id === VIRTUAL_ICEBERG_PROCEDURES) return RESOLVED_VIRTUAL_ICEBERG_PROCEDURES;
			return undefined;
		},
		load(id: string) {
			if (id !== RESOLVED_VIRTUAL_ICEBERG_PROCEDURES) return undefined;

			const globPattern = "/" + path.relative(process.cwd(), srcDir) + "/**/*.iceberg.ts";

			return [
				`const _modules = import.meta.glob(${JSON.stringify(globPattern)}, { eager: true });`,
				"",
				"// Aggregate all procedures into a single registry",
				"export const procedures = Object.assign({}, ...Object.values(_modules));",
			].join("\n");
		},
	};
}

interface Exports {
	queries: string[];
	mutations: string[];
}

function createClientProxyModule(exports: Exports, options: IcebergRemoteProceduresOptions): string {
	const lines: string[] = [];

	lines.push(options.proxyPrefix);

	for (const exportName of exports.queries) {
		lines.push(`export const ${exportName} = client.queries[${JSON.stringify(exportName)}];`);
	}

	for (const exportName of exports.mutations) {
		lines.push(`export const ${exportName} = client.mutations[${JSON.stringify(exportName)}];`);
	}

	if (exports.queries.length + exports.mutations.length === 0) {
		lines.push("export {};");
	}

	return lines.join("\n");
}

function extractExportNames(sourceText: string): Exports {
	// Detect queries: `export const foo = query(...)`
	const queryRegex = /export\s+const\s+(\w+)\s*=\s*query/g;
	const queries: string[] = [];
	let match: RegExpExecArray | null;
	while ((match = queryRegex.exec(sourceText)) !== null) {
		if (match[1]) queries.push(match[1]);
	}

	// Detect mutations: `export const foo = mutation(...)`
	const mutationRegex = /export\s+const\s+(\w+)\s*=\s*mutation/g;
	const mutations: string[] = [];
	while ((match = mutationRegex.exec(sourceText)) !== null) {
		if (match[1]) mutations.push(match[1]);
	}

	return { queries, mutations };
}