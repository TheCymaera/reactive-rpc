import { createServer, isRunnableDevEnvironment } from "vite";

const vite = await createServer({
	server: { middlewareMode: true },
	appType: "custom",
});

const backend = vite.environments.backend;
if (!backend || !isRunnableDevEnvironment(backend)) {
	throw new Error(
		'No "backend" environment found in Vite config. ' +
		'Make sure vite.config.ts defines environments.backend.'
	);
}

await backend.runner.import("/src/server/main.ts");