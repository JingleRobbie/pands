/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ['./src/**/*.{html,js,svelte}'],
	theme: {
		extend: {
			colors: {
				brand: '#1E3A5F',
				'brand-hover': '#122540',
				'brand-light': '#EEF2F8',
				accent: '#D97706',
				'accent-light': '#FEF3C7',
				sidebar: '#0F1E2E',
				'sidebar-hover': '#1A3050',
				'sidebar-active': '#1E3A5F',
			},
		},
	},
	plugins: [],
};
