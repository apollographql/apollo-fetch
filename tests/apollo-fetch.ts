import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { isEqual } from 'lodash';
import gql from 'graphql-tag';
import { print } from 'graphql';
import * as fetchMock from 'fetch-mock';
import {
  createApolloFetch,
} from '../src/apollo-fetch';
import {
  RequestAndOptions,
  ResponseAndOptions,
} from '../src/types';

chai.use(chaiAsPromised);

const { assert, expect } = chai;

const sampleQuery = gql`
query SampleQuery {
  stub{
    id
  }
}
`;

describe('apollo-fetch', () => {
  const postData = {hello: 'world', method: 'POST'};
  const data = JSON.stringify({data: { hello: 'world' }});
  const unparsableData = 'raw string';
  const mockError = { throws: new TypeError('mock me') };
  const swapiUrl = 'http://graphql-swapi.test/';
  const missingUrl = 'http://does-not-exist.test/';

  const unauthorizedUrl = 'http://unauthorized.test/';
  const serviceUnavailableUrl = 'http://service-unavailable.test/';

  const simpleQueryWithNoVars = gql`
    query people {
      allPeople(first: 1) {
        people {
          name
        }
      }
    }
  `;

  const simpleQueryWithVar = gql`
    query people($personNum: Int!) {
      allPeople(first: $personNum) {
        people {
          name
        }
      }
    }
  `;

  const simpleResult = {
    data: {
      allPeople: {
        people: [
          {
            name: 'Luke Skywalker',
          },
        ],
      },
    },
  };

  const complexQueryWithTwoVars = gql`
    query people($personNum: Int!, $filmNum: Int!) {
      allPeople(first: $personNum) {
        people {
          name
          filmConnection(first: $filmNum) {
            edges {
              node {
                id
              }
            }
          }
        }
      }
    }
  `;

  const complexResult = {
    data: {
      allPeople: {
        people: [
          {
            name: 'Luke Skywalker',
            filmConnection: {
              edges: [
                {
                  node: {
                    id: 'ZmlsbXM6MQ==',
                  },
                },
              ],
            },
          },
        ],
      },
    },
  };

  before(() => {

    fetchMock.post('/graphql', data);
    fetchMock.post('/raw', unparsableData);
    fetchMock.post('begin:data', postData);
    fetchMock.post('begin:error', mockError);
    fetchMock.post('test', data);

    fetchMock.post(swapiUrl, (url, opts) => {
      const { query, variables } = JSON.parse((opts as RequestInit).body!.toString());

      if (query === print(simpleQueryWithNoVars)) {
        return simpleResult;
      }

      if (query === print(simpleQueryWithVar)
          && isEqual(variables, { personNum: 1 })) {
        return simpleResult;
      }

      if (query === print(complexQueryWithTwoVars)
          && isEqual(variables, { personNum: 1, filmNum: 1 })) {
        return complexResult;
      }
      throw new Error('Invalid Query');
    });
    fetchMock.post(missingUrl, () => {
      throw new Error('Network error');
    });

    fetchMock.post(unauthorizedUrl, 403);
    fetchMock.post(serviceUnavailableUrl, 503);
  });

  afterEach(fetchMock.reset);

  it('should not throw with no arguments', () => {
    assert.doesNotThrow(createApolloFetch);
  });

  it('should call fetch', (done) => {
    const fetcher = createApolloFetch();
    const result = fetcher({query: print(sampleQuery)});
    result.then((response) => {
      assert.deepEqual(fetchMock.calls('/graphql').length, 1);
      assert.deepEqual(response, JSON.parse(data));
      done();
    });
  });

  const callAndCheckFetch = (uri, fetcher, numCalls, done) => {
    const result = fetcher({query: print(sampleQuery)});

    result.then((response) => {
      //correct response
      assert.deepEqual(response, JSON.parse(data));
      //single call
      assert.deepEqual(fetchMock.calls(uri).length, numCalls);

      assert.deepEqual(fetchMock.lastCall(uri)[0], uri);
      const options = fetchMock.lastCall(uri)[1];
      const body = JSON.parse(options.body);
      assert.deepEqual(options.method, 'POST');
      assert.deepEqual(options.headers, {Accept: '*/*', 'Content-Type': 'application/json'});
      assert.deepEqual(body.query, print(sampleQuery));
      done();
    });

  };

  it('should call fetch with correct arguments and result', (done) => {
    const uri = 'test';
    const fetcher = createApolloFetch({uri});
    callAndCheckFetch(uri, fetcher, 1, done);
  });

  it('should make two successful requests', (done) => {
    const uri = 'test';
    const fetcher = createApolloFetch({uri});
    const fetchWrapper = (callNumber, continuation) => callAndCheckFetch(uri, fetcher, callNumber, continuation);

    fetchWrapper(1, () => fetchWrapper(2, done));

  });

  it('should pass an error onto the Promise', () => {
    const uri = 'error';
    const fetcher = createApolloFetch({uri, customFetch: fetch});
    const result = fetcher({query: print(sampleQuery)});
    return assert.isRejected(result, mockError.throws, mockError.throws.message);
  });

// missingUrl

  it('should catch on a network error', (done) => {
    const fetcher = createApolloFetch({uri: unauthorizedUrl});
    const result = fetcher({query: print(sampleQuery)});
    result.then(expect.fail)
    .catch((error) => {
      assert.deepEqual(error.message, 'Network request failed with status 403 - \"Forbidden\"');
      assert.isDefined(error.response);
      assert.isDefined(error.parseError);
      done();
    });
  });

  it('should return a fail to parse response when fetch returns raw response', (done) => {
    const fetcher = createApolloFetch({uri: '/raw'});
    const result = fetcher({query: print(sampleQuery)});
    result.then(expect.fail)
    .catch((error) => {
      assert.deepEqual(error.message, 'Network request failed to return valid JSON');
      assert.isDefined(error.response);
      assert.isDefined(error.raw);
      assert.deepEqual(error.raw, unparsableData);
      done();
    });
  });


  describe('middleware', () => {
    it('should throw an error if you pass something bad', () => {
      const malWare: any = {};
      const networkInterface = createApolloFetch({ uri: '/graphql' });

      try {
        networkInterface.use([malWare]);
        expect.fail();
      } catch (error) {
        assert.equal(
          error.message,
          'Middleware must implement the applyMiddleware function',
        );
      }

    });

    it('should take a middleware and assign it', () => {
      const testWare = TestWare();

      const networkInterface = createApolloFetch({ uri: '/graphql' });
      networkInterface.use([testWare]);

      assert.equal((<any>networkInterface)._middlewares[0], testWare);
    });

    it('should take more than one middleware and assign it', () => {
      const testWare1 = TestWare();
      const testWare2 = TestWare();

      const networkInterface = createApolloFetch({ uri: '/graphql' });
      networkInterface.use([testWare1, testWare2]);

      assert.deepEqual((<any>networkInterface)._middlewares, [testWare1, testWare2]);
    });

    it('should alter the request variables', () => {
      const testWare1 = TestWare([
        { key: 'personNum', val: 1 },
      ]);

      const swapi = createApolloFetch({ uri: swapiUrl });
      swapi.use([testWare1]);
      // this is a stub for the end user client api
      const simpleRequest = {
        query: print(simpleQueryWithVar),
        variables: {},
        debugName: 'People query',
      };

      return assert.eventually.deepEqual(
        swapi(simpleRequest),
        simpleResult,
      );
    });

    it('should alter the options', () => {
      const testWare1 = TestWare([], [
        { key: 'planet', val: 'mars' },
      ]);

      const swapi = createApolloFetch({ uri: swapiUrl });
      swapi.use([testWare1]);
      // this is a stub for the end user client api
      const simpleRequest = {
        query: print(simpleQueryWithNoVars),
        variables: {},
        debugName: 'People query',
      };

      return swapi(simpleRequest).then(() => {
        assert.equal((fetchMock.lastCall()[1] as any).planet, 'mars');
      });
    });

    it('should alter the request body params', () => {
      const testWare1 = TestWare([], [], [
        { key: 'newParam', val: '0123456789' },
      ]);

      const swapi = createApolloFetch({ uri: 'http://graphql-swapi.test/' });
      swapi.use([testWare1]);
      const simpleRequest = {
        query: print(simpleQueryWithVar),
        variables: { personNum: 1 },
        debugName: 'People query',
      };

      return swapi(simpleRequest).then(() => {
        return assert.deepEqual(
          JSON.parse((fetchMock.lastCall()[1] as any).body),
          {
            query: 'query people($personNum: Int!) {\n  allPeople(first: $personNum) {\n    people {\n      name\n    }\n  }\n}\n',
            variables: { personNum: 1 },
            debugName: 'People query',
            newParam: '0123456789',
          },
        );
      });
    });

    it('handle multiple middlewares', () => {
      const testWare1 = TestWare([
        { key: 'personNum', val: 1 },
      ]);
      const testWare2 = TestWare([
        { key: 'filmNum', val: 1 },
      ]);

      const swapi = createApolloFetch({ uri: 'http://graphql-swapi.test/' });
      swapi.use([testWare1, testWare2]);
      // this is a stub for the end user client api
      const simpleRequest = {
        query: print(complexQueryWithTwoVars),
        variables: {},
        debugName: 'People query',
      };

      return assert.eventually.deepEqual(
        swapi(simpleRequest),
        complexResult,
      );
    });

    it('should chain use() calls', () => {
      const testWare1 = TestWare([
        { key: 'personNum', val: 1 },
      ]);
      const testWare2 = TestWare([
        { key: 'filmNum', val: 1 },
      ]);

      const swapi = createApolloFetch({ uri: swapiUrl });
      swapi.use([testWare1])
        .use([testWare2]);
      const simpleRequest = {
        query: print(complexQueryWithTwoVars),
        variables: {},
        debugName: 'People query',
      };

      return assert.eventually.deepEqual(
        swapi(simpleRequest),
        complexResult,
      );
    });

    it('should chain use() and useAfter() calls', () => {
      const testWare1 = TestWare();
      const testWare2 = TestAfterWare();

      const networkInterface = createApolloFetch({ uri: swapiUrl });
      networkInterface.use([testWare1])
        .useAfter([testWare2]);
      assert.deepEqual((<any>networkInterface)._middlewares, [testWare1]);
      assert.deepEqual((<any>networkInterface)._afterwares, [testWare2]);
    });

  });

  describe('afterware', () => {
    it('should return errors thrown in afterwares', () => {
      const networkInterface = createApolloFetch({ uri: swapiUrl });
      networkInterface.useAfter([{
        applyAfterware() {
          throw Error('Afterware error');
        },
      }]);

      const simpleRequest = {
        query: print(simpleQueryWithNoVars),
        variables: {},
        debugName: 'People query',
      };

      return assert.isRejected(
        networkInterface(simpleRequest),
        Error,
        'Afterware error',
      );
    });
    it('should throw an error if you pass something bad', () => {
      const malWare = TestAfterWare();
      delete malWare.applyAfterware;
      const networkInterface = createApolloFetch({ uri: '/graphql' });

      try {
        networkInterface.useAfter([malWare]);
        expect.fail();
      } catch (error) {
        assert.equal(
          error.message,
          'Afterware must implement the applyAfterware function',
        );
      }

    });

    it('should take a afterware and assign it', () => {
      const testWare = TestAfterWare();

      const networkInterface = createApolloFetch({ uri: '/graphql' });
      networkInterface.useAfter([testWare]);

      assert.equal((<any>networkInterface)._afterwares[0], testWare);
    });

    it('should take more than one afterware and assign it', () => {
      const testWare1 = TestAfterWare();
      const testWare2 = TestAfterWare();

      const networkInterface = createApolloFetch({ uri: '/graphql' });
      networkInterface.useAfter([testWare1, testWare2]);

      assert.deepEqual((<any>networkInterface)._afterwares, [testWare1, testWare2]);
    });

    it('should chain useAfter() calls', () => {
      const testWare1 = TestAfterWare();
      const testWare2 = TestAfterWare();

      const networkInterface = createApolloFetch({ uri: '/graphql' });
      networkInterface.useAfter([testWare1])
        .useAfter([testWare2]);

      assert.deepEqual((<any>networkInterface)._afterwares, [testWare1, testWare2]);
    });

    it('should chain useAfter() and use() calls', () => {
      const testWare1 = TestAfterWare();
      const testWare2 = TestWare();

      const networkInterface = createApolloFetch({ uri: swapiUrl });
      networkInterface.useAfter([testWare1])
        .use([testWare2]);
      assert.deepEqual((<any>networkInterface)._middlewares, [testWare2]);
      assert.deepEqual((<any>networkInterface)._afterwares, [testWare1]);
    });

  });

});

// simulate middleware by altering variables and options
function TestWare(
  variables: Array<{ key: string, val: any }> = [],
  options: Array<{ key: string, val: any }> = [],
  bodyParams: Array<{ key: string, val: any }> = [],
) {

  return {
    applyMiddleware: (request: RequestAndOptions, next: Function): void => {
      variables.map((variable) => {
        (<any>request.request.variables)[variable.key] = variable.val;
      });

      options.map((variable) => {
        (<any>request.options)[variable.key] = variable.val;
      });

      bodyParams.map((param) => {
        request.request[param.key as string] = param.val;
      });

      next();
    },
  };
}

// simulate afterware by altering variables and options
function TestAfterWare(
  options: Array<{ key: string, val: any }> = [],
) {

  return {
    applyAfterware: (response: ResponseAndOptions, next: Function): void => {
      options.map((variable) => {
        (<any>response.options)[variable.key] = variable.val;
      });

      next();
    },
  };
}
