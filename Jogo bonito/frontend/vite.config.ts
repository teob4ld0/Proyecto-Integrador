import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

const isMobileJsEntry = new URL('./node_modules/ismobilejs/esm/isMobile.js', import.meta.url).href;
const qsEntry = new URL('./node_modules/qs/lib/index.js', import.meta.url).href;

export default defineConfig({
	plugins: [sveltekit()],
	resolve: {
		alias: {
			// Work around Rolldown failing to resolve ismobilejs from pixi internals.
			ismobilejs: isMobileJsEntry,
			// Work around Rolldown failing to resolve qs from url polyfill.
			qs: qsEntry
		}
	},
	server: {
		host: '0.0.0.0',
		port: 5173
	}
});
