/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ['./src/**/*.{html,js,svelte}'],
	theme: {
		extend: {
			colors: {
				sidebar: '#1e2433',
				'sidebar-hover': '#2a3347',
				'sidebar-active': '#3b4a6b',
			},
		},
	},
	plugins: [],
};
