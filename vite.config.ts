import * as vite from "vite";
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from "@tailwindcss/vite";

export default vite.defineConfig({
	plugins: [
		tailwindcss(),
		svelte(),
	],
	
	server: {
		host: true,
		proxy: {
			'/api': {
				target: 'http://127.0.0.1:3000',
				changeOrigin: true,
				secure: false,
				ws: true,
			}
		}
	},
});