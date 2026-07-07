import * as vite from "vite";
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from "@tailwindcss/vite";
import { icebergRemoteProcedures } from "@iceberg/core/vite-plugin";

export default vite.defineConfig({
	plugins: [
		icebergRemoteProcedures({
			proxyPrefix: `import { myClient as client } from "/src/client/myClient.js";`,
		}),
		tailwindcss(),
		svelte(),
	],

	environments: {
		client: { },
		backend: { },
	},

	server: {
		host: true,
		proxy: {
			'/api': {
				target: 'http://127.0.0.1:3000',
				changeOrigin: true,
				secure: false,
			}
		}
	},
});
