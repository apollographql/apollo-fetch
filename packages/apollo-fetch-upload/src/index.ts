import {
  constructDefaultOptions,
  createApolloFetch,
  // Types:
  ApolloFetch,
  FetchOptions,
  GraphQLRequest,
} from 'apollo-fetch';
import { ReactNativeFile, extractFiles } from 'extract-files';

export { ReactNativeFile };

export function constructUploadOptions(
  requestOrRequests: GraphQLRequest | GraphQLRequest[],
  options: RequestInit,
): RequestInit {
  const files = extractFiles(requestOrRequests);

  if (files.length) {
    if (typeof FormData === 'undefined') {
      throw new Error('Environment must support FormData to upload files.');
    }

    options.method = 'POST';
    options.body = new FormData();
    options.body.append('operations', JSON.stringify(requestOrRequests));
    files.forEach(({ path, file }) => options.body.append(path, file));

    return options;
  }

  return constructDefaultOptions(requestOrRequests, options);
}

export function createApolloFetchUpload(params: FetchOptions = {}): ApolloFetch {
  return createApolloFetch({
    ...params,
    constructOptions: constructUploadOptions,
  });
}
