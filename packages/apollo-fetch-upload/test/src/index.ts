import test from 'ava';
import { constructDefaultOptions } from 'apollo-fetch';
import { constructUploadOptions } from '../../src/index.js';

const requestWithoutFiles = {
  operationName: 'noFiles',
  query: 'query noFiles(foo: Boolean!) { noFiles(foo: $foo) { bar } }',
  variables: {
    foo: true,
  },
};

test('constructUploadOptions reverts to constructDefaultOptions if there are no files', t => {
  const options = { headers: { foo: true } };
  const uploadOptions = constructUploadOptions(requestWithoutFiles, options);
  const defaultOptions = constructDefaultOptions(requestWithoutFiles, options);

  t.deepEqual(uploadOptions, defaultOptions);
});
