// ESLint configuration -- based on obsidian-dev-utils strict config,
// Adapted for Google Apps Script (no modules, global scope).
// Omitted from obsidian-dev-utils: import-x, modules-newlines, obsidian plugin (not applicable).

import commentsConfigs from '@eslint-community/eslint-plugin-eslint-comments/configs';
import eslint from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import perfectionist from 'eslint-plugin-perfectionist';
import {
  defineConfig,
  globalIgnores
} from 'eslint/config';
import tseslint from 'typescript-eslint';

/* eslint-disable no-magic-numbers -- ESLint config values. */

export default defineConfig(
  globalIgnores([
    '**/*.js',
    '**/node_modules/'
  ]),
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  commentsConfigs.recommended,
  perfectionist.configs['recommended-alphabetical'],
  stylistic.configs.recommended,
  stylistic.configs.customize({
    arrowParens: true,
    braceStyle: '1tbs',
    commaDangle: 'never',
    semi: true
  }),
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    },
    plugins: {
      '@stylistic': stylistic
    },
    rules: {
      '@eslint-community/eslint-comments/require-description': 'error',
      '@stylistic/indent': 'off',
      '@stylistic/indent-binary-ops': 'off',
      '@stylistic/jsx-one-expression-per-line': 'off',
      '@stylistic/no-extra-semi': 'error',
      '@stylistic/object-curly-newline': [
        'error',
        {
          ExportDeclaration: {
            minProperties: 2,
            multiline: true
          },
          ImportDeclaration: {
            minProperties: 2,
            multiline: true
          }
        }
      ],
      '@stylistic/operator-linebreak': [
        'error',
        'before',
        { overrides: { '=': 'after' } }
      ],
      '@stylistic/quotes': [
        'error',
        'single',
        { allowTemplateLiterals: 'never' }
      ],
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/explicit-member-accessibility': 'error',
      '@typescript-eslint/no-invalid-void-type': ['error', {
        allowAsThisParameter: true
      }],
      '@typescript-eslint/no-this-alias': ['error', {
        allowedNames: ['that']
      }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'all',
          argsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          ignoreRestSiblings: true,
          varsIgnorePattern: '^_'
        }
      ],
      '@typescript-eslint/prefer-readonly': 'error',
      'accessor-pairs': 'error',
      'array-callback-return': 'error',
      'camelcase': 'error',
      'capitalized-comments': ['error', 'always', { block: { ignorePattern: 'v8' } }],
      'complexity': 'error',
      'consistent-this': 'error',
      'curly': 'error',
      'default-case': 'error',
      'default-case-last': 'error',
      'default-param-last': 'error',
      'eqeqeq': 'error',
      'func-name-matching': 'error',
      'func-names': 'error',
      'func-style': [
        'error',
        'declaration',
        { allowArrowFunctions: false }
      ],
      'grouped-accessor-pairs': ['error', 'getBeforeSet'],
      'guard-for-in': 'error',
      'no-alert': 'error',
      'no-array-constructor': 'error',
      'no-bitwise': 'error',
      'no-caller': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-constructor-return': 'error',
      'no-div-regex': 'error',
      'no-else-return': ['error', { allowElseIf: false }],
      'no-empty-function': 'error',
      'no-extend-native': 'error',
      'no-extra-bind': 'error',
      'no-extra-label': 'error',
      'no-implicit-coercion': ['error', { allow: ['!!'] }],
      'no-implied-eval': 'error',
      'no-inner-declarations': 'error',
      'no-iterator': 'error',
      'no-label-var': 'error',
      'no-labels': 'error',
      'no-lone-blocks': 'error',
      'no-lonely-if': 'error',
      'no-loop-func': 'error',
      'no-magic-numbers': [
        'error',
        {
          detectObjects: true,
          enforceConst: true,
          ignore: [-1, 0, 1]
        }
      ],
      'no-multi-assign': 'error',
      'no-multi-str': 'error',
      'no-negated-condition': 'error',
      'no-nested-ternary': 'error',
      'no-new-func': 'error',
      'no-new-wrappers': 'error',
      'no-object-constructor': 'error',
      'no-octal-escape': 'error',
      'no-promise-executor-return': 'error',
      'no-proto': 'error',
      'no-restricted-syntax': [
        'error',
        {
          message: 'Do not use definite assignment assertions (!). Initialize the field or make it optional.',
          selector: 'PropertyDefinition[definite=true]'
        },
        {
          message: 'Do not use definite assignment assertions (!) on abstract fields.',
          selector: 'TSAbstractPropertyDefinition[definite=true]'
        },
        {
          message: 'Do not use anonymous inline object types in function parameters. Define a named interface instead.',
          selector: ':function > Identifier TSTypeLiteral'
        },
        {
          message: 'Do not use anonymous inline object types in function return types. Define a named interface instead.',
          selector: ':function > TSTypeAnnotation:last-child TSTypeLiteral'
        },
        {
          message: 'Do not use anonymous inline object types in interface/method signatures. Define a named interface instead.',
          selector: 'TSMethodSignature TSTypeLiteral'
        }
      ],
      'no-return-assign': 'error',
      'no-script-url': 'error',
      'no-self-compare': 'error',
      'no-sequences': 'error',
      'no-shadow': 'error',
      'no-template-curly-in-string': 'error',
      'no-throw-literal': 'error',
      'no-unmodified-loop-condition': 'error',
      'no-unneeded-ternary': 'error',
      'no-unreachable-loop': 'error',
      'no-unused-expressions': 'error',
      'no-useless-assignment': 'error',
      'no-useless-call': 'error',
      'no-useless-computed-key': 'error',
      'no-useless-concat': 'error',
      'no-useless-constructor': 'error',
      'no-useless-rename': 'error',
      'no-useless-return': 'error',
      'no-var': 'error',
      'no-void': 'error',
      'object-shorthand': 'error',
      'operator-assignment': 'error',
      'prefer-arrow-callback': 'error',
      'prefer-const': 'error',
      'prefer-exponentiation-operator': 'error',
      'prefer-named-capture-group': 'error',
      'prefer-numeric-literals': 'error',
      'prefer-object-has-own': 'error',
      'prefer-object-spread': 'error',
      'prefer-promise-reject-errors': 'error',
      'prefer-regex-literals': 'error',
      'prefer-rest-params': 'error',
      'prefer-spread': 'error',
      'prefer-template': 'error',
      'radix': 'error',
      'require-atomic-updates': 'error',
      'require-await': 'error',
      'symbol-description': 'error',
      'unicode-bom': 'error',
      'vars-on-top': 'error',
      'yoda': 'error'
    }
  },
  {
    files: ['__tests__/**/*.ts'],
    rules: {
      'no-magic-numbers': 'off'
    }
  }
);

/* eslint-enable no-magic-numbers -- ESLint config values. */
