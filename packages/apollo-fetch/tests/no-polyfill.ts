import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { createApolloFetch } from '../src/apollo-fetch';

chai.use(chaiAsPromised);

const { assert } = chai;

describe('apollo-fetch', () => {
  describe('createApolloFetch', () => {
    it('should throw if fetch api is not present', () => {
      assert.throws(() => {
        createApolloFetch({ uri: 'test' });
      }, /Global fetch API must be present or customFetch must be provided/);
    });

    it('should not throw if fetch api is not present but customFetch is provided', () => {
      assert.doesNotThrow(() => {
        createApolloFetch({
          uri: 'test',
          customFetch: () =>
            new Promise((resolve, reject) => {
              resolve(new Response());
            }),
        });
      });
    });
  });
});
