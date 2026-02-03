import svelte from 'eslint-plugin-svelte';
import tsParser from '@typescript-eslint/parser';

export default [
	...svelte.configs['flat/recommended'],
	{
		files: ['**/*.svelte'],
		languageOptions: {
			parserOptions: {
				parser: tsParser,
				extraFileExtensions: ['.svelte'],
			},
		},
	},
	{
		ignores: ['.svelte-kit/', 'node_modules/', 'build/'],
	},
];
