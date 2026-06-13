import lodash from 'lodash';
import minimatch from 'minimatch';

export const demo = {
  compact: lodash.compact([0, 1, false, 2]),
  matches: minimatch('src/index.ts', 'src/**/*.ts'),
};
