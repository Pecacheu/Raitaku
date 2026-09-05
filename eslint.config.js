import js from '@eslint/js';
import sty from '@stylistic/eslint-plugin';
import { defineConfig } from 'eslint/config';
import esi from 'eslint-plugin-import-x';
import globals from 'globals';

export default defineConfig([
	{ignores: ['dist', 'data']},
	{
		files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
		plugins: {js, sty, import: esi},
		extends: [
			'js/recommended',
			'import/flat/recommended'
		],
		languageOptions: {
			globals: {...globals.browser, ...globals.node},
			parserOptions: {sourceType: 'module'}
		},
		rules: {
			'no-empty': ['warn', {allowEmptyCatch: true}],
			'prefer-const': ['warn', {destructuring: 'all'}],
			'no-useless-assignment': 'warn',

			'import-x/no-named-as-default': 'off',
			'import-x/no-unresolved': 'off',
			'import-x/order': ['warn', {
				groups: ['builtin', 'external', 'internal'],
				alphabetize: {order: 'asc', caseInsensitive: true}
			}],

			'sty/max-len': ['warn', {code: 120, ignoreTemplateLiterals: true}],
			'sty/linebreak-style': ['error', 'unix'],
			'sty/eol-last': ['warn', 'never'],
			'sty/no-trailing-spaces': 'warn',
			'sty/no-multiple-empty-lines': ['warn', {max: 1, maxBOF: 0, maxEOF: 0}],
			'sty/lines-between-class-members': ['warn', 'always', {
				exceptAfterSingleLine: true,
				exceptAfterOverload: true
			}],
			'sty/semi': ['warn', 'always', {omitLastInOneLineBlock: true}],
			'sty/semi-spacing': 'warn',
			'sty/indent': ['warn', 'tab', {
				SwitchCase: 0,
				FunctionDeclaration: {parameters: 2}
			}],
			'sty/no-mixed-spaces-and-tabs': 'warn',
			'sty/dot-location': ['warn', 'property'],
			'sty/keyword-spacing': ['warn', {
				overrides: {
					if: {after: false},
					for: {after: false},
					while: {after: false},
					switch: {after: false}
				}
			}],
			'sty/space-infix-ops': 'warn',
			'sty/space-unary-ops': 'warn',
			'sty/space-in-parens': 'warn',
			'sty/function-call-spacing': 'warn',
			'sty/space-before-function-paren': ['warn', {
				anonymous: 'never',
				named: 'never',
				asyncArrow: 'always',
				catch: 'never'
			}],
			'sty/no-extra-parens': 'warn',
			'sty/arrow-spacing': 'warn',
			'sty/comma-spacing': 'warn',
			'sty/no-whitespace-before-property': 'warn',
			'sty/no-multi-spaces': 'warn',
			'sty/space-before-blocks': 'warn',
			'sty/padded-blocks': ['warn', 'never'],
			'sty/comma-dangle': 'warn',
			'sty/type-annotation-spacing': 'warn',
			'sty/type-generic-spacing': 'warn',
			'sty/type-named-tuple-spacing': 'warn',
			'sty/key-spacing': 'warn',
			'sty/multiline-ternary': ['warn', 'always-multiline'],
			'sty/operator-linebreak': ['warn', 'before'],
			'sty/array-bracket-spacing': ['warn', 'never'],
			'sty/array-bracket-newline': ['warn', 'consistent'],
			'sty/array-element-newline': ['warn', 'consistent'],
			'sty/computed-property-spacing': 'warn',
			'sty/object-curly-spacing': ['warn', 'never', {overrides: {ImportDeclaration: 'always'}}],
			'sty/object-curly-newline': ['warn', {consistent: true}],
			'sty/object-property-newline': ['warn', {allowAllPropertiesOnSameLine: true}],
			'sty/quote-props': ['warn', 'as-needed'],
			'sty/quotes': ['warn', 'single', {avoidEscape: true, allowTemplateLiterals: 'always'}],
			'sty/curly-newline': ['warn', {consistent: true}],
			'sty/brace-style': ['warn', '1tbs', {allowSingleLine: true}],
			'sty/function-paren-newline': ['warn', 'never'],
			'sty/max-statements-per-line': ['warn', {ignoredNodes: [
				'TryStatement', 'BreakStatement', 'FunctionDeclaration'
			]}]
		}
	}
]);