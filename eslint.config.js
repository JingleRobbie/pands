import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';

export default [
	// Config files at the root use CommonJS or mixed module patterns — skip them
	{
		ignores: [
			'node_modules/**',
			'.svelte-kit/**',
			'build/**',
			'static/**',
			'tailwind.config.js',
			'scripts/**',
		],
	},

	// Base JS rules for all source files
	{
		...js.configs.recommended,
		languageOptions: {
			globals: {
				...globals.node, // process, console, Buffer, etc.
				...globals.browser, // fetch, URL, Response, localStorage, etc.
			},
		},
	},

	// Svelte component rules
	...svelte.configs['flat/recommended'],

	// Project-wide rule overrides
	{
		rules: {
			'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
			// SvelteKit uses plain <a href> links everywhere — the resolve() wrapper
			// is only needed when intercepting navigation programmatically
			'svelte/no-navigation-without-resolve': 'off',
			// Every {#each} must have a key expression, e.g. {#each items as item (item.id)}
			'svelte/require-each-key': 'error',
		},
	},
];
