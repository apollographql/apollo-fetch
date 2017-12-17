import * as apolloFetch from 'apollo-fetch';
import * as apolloFetchPolyfill from '../index';

describe('apollo-fetch-polyfill', () => {
  it('exports the same things as apollo-fetch', () => {
    expect(Object.keys(apolloFetchPolyfill)).toEqual(Object.keys(apolloFetch));
  });

  it('installs global fetch polyfill', () => {
    expect(typeof fetch).toBe('function');
    expect(typeof Headers).toBe('function');
    expect(typeof Request).toBe('function');
    expect(typeof Response).toBe('function');
  });
});
