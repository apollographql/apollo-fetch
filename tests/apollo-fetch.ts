import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as sinon from 'sinon';
import { isEqual } from 'lodash';
import gql from 'graphql-tag';
import { print } from 'graphql';
import * as fetchMock from 'fetch-mock';
import {
  createApolloFetch,
  apolloFetch as apolloFetchWrapper,
} from '../src/apollo-fetch';
import {
  RequestAndOptions,
  FetchResult,
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
  const data = JSON.stringify({data: { hello: 'world', uri: '/graphql' }});
  const alternateData = JSON.stringify({data: { hello: 'alternate world', uri: 'alternate' }});
  const unparsableData = 'raw string';
  const unauthorizedData = {
    data: {
      user: null,
    },
  };

  const mockError = { throws: new TypeError('mock me') };

  const swapiUrl = 'http://graphql-swapi.test/';
  const missingUrl = 'http://does-not-exist.test/';

  const unauthorizedUrl = 'http://unauthorized.test/';
  const forbiddenUrl = 'http://forbidden.test/';
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
    fetchMock.post('alternate', alternateData);
    fetchMock.post('/raw', unparsableData);
    fetchMock.post('data', postData);
    fetchMock.post('error', mockError);
    fetchMock.post('test', data);

    fetchMock.post(unauthorizedUrl, unauthorizedData);

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

    fetchMock.post(forbiddenUrl, 403);
    fetchMock.post(serviceUnavailableUrl, 503);
  });

  afterEach(fetchMock.reset);

  it('should not throw with no arguments', () => {
    assert.doesNotThrow(createApolloFetch);
  });

  it('should call fetch', () => {
    const fetcher = createApolloFetch();
    const result = fetcher({query: print(sampleQuery)});
    return result.then((response) => {
      assert.deepEqual(fetchMock.calls('/graphql').length, 1);
      assert.deepEqual(response, JSON.parse(data));
    });
  });

  const callAndCheckFetch = (uri, fetcher) => {
    const result = fetcher({query: print(sampleQuery)});

    return result.then((response) => {
      //correct response
      assert.deepEqual(response, JSON.parse(data));

      assert.deepEqual(fetchMock.lastCall(uri)[0], uri);
      const options = fetchMock.lastCall(uri)[1];
      const body = JSON.parse(options.body);
      assert.deepEqual(options.method, 'POST');
      assert.deepEqual(options.headers, {Accept: '*/*', 'Content-Type': 'application/json'});
      assert.deepEqual(body.query, print(sampleQuery));
    });

  };

  it('should call fetch with correct arguments and result', () => {
    const uri = 'test';
    const fetcher = createApolloFetch({uri});
    return callAndCheckFetch(uri, fetcher);
  });

  it('should make two successful requests', () => {
    const uri = 'test';
    const fetcher = createApolloFetch({uri});
    return callAndCheckFetch(uri, fetcher)
      .then(() => callAndCheckFetch(uri, fetcher));
  });

  it('should pass an error onto the Promise', () => {
    const uri = 'error';
    const fetcher = createApolloFetch({uri, customFetch: fetch});
    const result = fetcher({query: print(sampleQuery)});
    return assert.isRejected(result, mockError.throws, mockError.throws.message);
  });

  it('should catch on a network error', () => {
    const fetcher = createApolloFetch({uri: forbiddenUrl});
    const result = fetcher({query: print(sampleQuery)});
    return result.then(expect.fail)
      .catch((error) => {
        assert.deepEqual(error.message, 'Network request failed with status 403 - \"Forbidden\"');
        assert.isDefined(error.response);
        assert.isDefined(error.parseError);
      });
  });

  it('should return a fail to parse response when fetch returns raw response', () => {
    const fetcher = createApolloFetch({uri: '/raw'});
    const result = fetcher({query: print(sampleQuery)});
    return result.then(expect.fail)
      .catch((error) => {
        assert.deepEqual(error.message, 'Network request failed to return valid JSON');
        assert.isDefined(error.response);
        assert.deepEqual(error.response.raw, unparsableData);
      });
  });

  it('should pass the parsed response if valid regardless of the status', () => {
    const fetcher = createApolloFetch({
      uri: unauthorizedUrl,
      customFetch: () => new Promise((resolve, reject) => {
        const init = {
          status: 401,
          statusText: 'Unauthorized',
        };
        const body = JSON.stringify(unauthorizedData);
        resolve(new Response(body, init));
      }),
    });

    return fetcher({query: print(sampleQuery)}).then((result) => {
        assert.deepEqual(result.data, unauthorizedData.data);
    });
  });

  describe('apolloFetch wrapper', () => {
    it('should take a operation make a call to fetch at /graphql with the correct body', () => {
      const operation = {variables: {}};
      return apolloFetchWrapper(operation).then(result => {
        assert.deepEqual(result, JSON.parse(data));
        assert.deepEqual(JSON.parse((fetchMock.lastCall()[1] as any).body), operation);
      });
    });
  });

  describe('middleware', () => {
    it('should throw an error if middleware is not a function', () => {
      const malWare: any = {};
      const apolloFetch = createApolloFetch({ uri: '/graphql' });

      try {
        apolloFetch.use(malWare);
        expect.fail();
      } catch (error) {
        assert.equal(
          error.message,
          'Middleware must be a function',
        );
      }

    });

    it('should return errors thrown in middlewares', () => {
      const apolloFetch = createApolloFetch({ uri: swapiUrl });
      apolloFetch.use(() => { throw Error('Middleware error'); });

      const simpleRequest = {
        query: print(simpleQueryWithNoVars),
        variables: {},
        debugName: 'People query',
      };

      return assert.isRejected(
        apolloFetch(simpleRequest),
        Error,
        'Middleware error',
      );
    });

    it('can alter the request variables', () => {
      const testWare1 = TestWare([
        { key: 'personNum', val: 1 },
      ]);

      const swapi = createApolloFetch({ uri: swapiUrl });
      swapi.use(testWare1);
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

    it('can alter the options', () => {
      const testWare1 = TestWare([], [
        { key: 'planet', val: 'mars' },
      ]);

      const swapi = createApolloFetch({ uri: swapiUrl });
      swapi.use(testWare1);
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

    it('can alter the request body params', () => {
      const testWare1 = TestWare([], [], [
        { key: 'newParam', val: '0123456789' },
      ]);

      const swapi = createApolloFetch({ uri: 'http://graphql-swapi.test/' });
      swapi.use(testWare1);
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
      swapi.use(testWare1).use(testWare2);
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
      swapi.use(testWare1)
        .use(testWare2);
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

  });

  describe('afterware', () => {
    it('should return errors thrown in afterwares', () => {
      const apolloFetch = createApolloFetch({ uri: swapiUrl });
      apolloFetch.useAfter(() => { throw Error('Afterware error'); });

      const simpleRequest = {
        query: print(simpleQueryWithNoVars),
        variables: {},
        debugName: 'People query',
      };

      return assert.isRejected(
        apolloFetch(simpleRequest),
        Error,
        'Afterware error',
      );
    });

    it('should throw an error if afterware is not a function', () => {
      const malWare = {} as any;
      const apolloFetch = createApolloFetch({ uri: '/graphql' });

      try {
        apolloFetch.useAfter(malWare);
        expect.fail();
      } catch (error) {
        assert.equal(
          error.message,
          'Afterware must be a function',
        );
      }
    });

    it('can modify response to add data when response is not parsable', () => {
      const parsedData = {
        data: {
          mock: 'stub',
        },
      };
      const afterware = ({ response }, next) => {
        assert.deepEqual(response.status, 403);
        assert.deepEqual(response.raw, '');
        assert.isUndefined(response.parsed);

        response.parsed = parsedData;
        next();
      };
      const apolloFetch = createApolloFetch({ uri: forbiddenUrl });

      apolloFetch.useAfter(afterware);

      return assert.eventually.deepEqual(apolloFetch({ query: '' }), parsedData);
    });

    it('handle multiple afterware', () => {
      const spy = sinon.spy();
      const afterware1 = ({ response }, next) => {
        assert.deepEqual(response.status, 200);
        spy();
        next();
      };
      const afterware2 = ({ response }, next) => {
        spy();
        next();
      };

      const swapi = createApolloFetch({ uri: 'http://graphql-swapi.test/' });
      swapi.useAfter(afterware1);
      swapi.useAfter(afterware2);
      // this is a stub for the end user client api
      const simpleRequest = {
        query: print(complexQueryWithTwoVars),
        variables: {
          personNum: 1,
          filmNum: 1,
        },
        debugName: 'People query',
      };

      return swapi(simpleRequest).then( result => {
        assert.deepEqual(result, <FetchResult>complexResult);
        assert(spy.calledTwice, 'both afterware should be called');
      }).catch(console.log);
    });
  });

  describe('multiple requests', () => {
    it('handle multiple middlewares', () => {
      const testWare1 = TestWare([
        { key: 'personNum', val: 1 },
      ]);
      const testWare2 = TestWare([
        { key: 'filmNum', val: 1 },
      ]);

      const swapi = createApolloFetch({ uri: 'http://graphql-swapi.test/' });
      swapi.use(testWare1).use(testWare2);
      // this is a stub for the end user client api
      const simpleRequest = {
        query: print(complexQueryWithTwoVars),
        variables: {},
        debugName: 'People query',
      };

      return assert.eventually.deepEqual(
        swapi(simpleRequest),
        complexResult,
      ).then(() => assert.eventually.deepEqual(
        swapi(simpleRequest),
        complexResult,
      ));
    });

    it('handle multiple afterware', () => {
      const spy = sinon.spy();

      const afterware1 = ({ response }, next) => {
        assert.deepEqual(response.status, 200);
        spy();
        next();
      };
      const afterware2 = ({ response }, next) => {
        spy();
        next();
      };

      const swapi = createApolloFetch({ uri: 'http://graphql-swapi.test/' });
      swapi.useAfter(afterware1).useAfter(afterware2);
      // this is a stub for the end user client api
      const simpleRequest = {
        query: print(complexQueryWithTwoVars),
        variables: {
          personNum: 1,
          filmNum: 1,
        },
        debugName: 'People query',
      };

      return swapi(simpleRequest).then( result => {
        assert.deepEqual(result, <FetchResult>complexResult);
        assert(spy.calledTwice, 'both afterware should be called');
        spy.reset();
      }).then(() => swapi(simpleRequest).then( result => {
        assert.deepEqual(result, <FetchResult>complexResult);
        assert(spy.calledTwice, 'both afterware should be called');
      }));
    });

    it('handle multiple middleware and afterware', () => {
      const testWare1 = TestWare([
        { key: 'personNum', val: 1 },
      ]);
      const testWare2 = TestWare([
        { key: 'filmNum', val: 1 },
      ]);

      const spy = sinon.spy();

      const afterware1 = ({ response }, next) => {
        assert.deepEqual(response.status, 200);
        spy();
        next();
      };
      const afterware2 = ({ response }, next) => {
        spy();
        next();
      };

      const swapi = createApolloFetch({ uri: 'http://graphql-swapi.test/' });
      swapi.useAfter(afterware1).useAfter(afterware2)
        .use(testWare1).use(testWare2);
      // this is a stub for the end user client api
      const simpleRequest = {
        query: print(complexQueryWithTwoVars),
        variables: {},
        debugName: 'People query',
      };

      return swapi(simpleRequest).then( result => {
        assert.deepEqual(result, <FetchResult>complexResult);
        assert(spy.calledTwice, 'both afterware should be called');
        spy.reset();
      }).then(() => swapi(simpleRequest).then( result => {
        assert.deepEqual(result, <FetchResult>complexResult);
        assert(spy.calledTwice, 'both afterware should be called');
      }));
    });
  });
});

// simulate middleware by altering variables and options
function TestWare(
  variables: Array<{ key: string, val: any }> = [],
  options: Array<{ key: string, val: any }> = [],
  bodyParams: Array<{ key: string, val: any }> = [],
) {

  return (request: RequestAndOptions, next: Function): void => {
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
  };
}
