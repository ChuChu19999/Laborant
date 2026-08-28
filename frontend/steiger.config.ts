import fsd from '@feature-sliced/steiger-plugin';
import { defineConfig } from 'steiger';

export default defineConfig([
  ...fsd.configs.recommended,
  {
    rules: {
      'fsd/public-api': 'error',
      'fsd/no-public-api-sidestep': 'error',
      'fsd/no-cross-imports': 'error',
      'fsd/excessive-slicing': 'off',
      'fsd/insignificant-slice': 'off',
      'fsd/inconsistent-naming': 'off',
      'fsd/repetitive-naming': 'off',
      'fsd/segments-by-purpose': 'off',
      'fsd/no-reserved-folder-names': 'off',
    },
  },
]);
