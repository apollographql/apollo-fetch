import test from 'ava';
import { constructDefaultOptions } from 'apollo-fetch';
import { constructUploadOptions } from '../../src/index.js';

const mockRequestWithoutFiles = {
  operationName: 'withoutFiles',
  query:
    'query withoutFiles(foo: Boolean!) { withoutFiles(foo: $foo) { bar } }',
  variables: {
    foo: true,
  },
};

const mockFetchOptions: RequestInit = {
  headers: new Headers({
    foo: 'true',
  }),
};

test('constructUploadOptions without files reverts to constructDefaultOptions', t => {
  t.deepEqual(
    constructUploadOptions(mockRequestWithoutFiles, mockFetchOptions),
    constructDefaultOptions(mockRequestWithoutFiles, mockFetchOptions),
  );
});
