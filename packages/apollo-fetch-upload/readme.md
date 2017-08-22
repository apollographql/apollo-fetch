# apollo-fetch-upload

[![npm version](https://img.shields.io/npm/v/apollo-fetch-upload.svg)](https://www.npmjs.com/package/apollo-fetch-upload)

Enables the use of [`File`](https://developer.mozilla.org/en/docs/Web/API/File), [`FileList`](https://developer.mozilla.org/en/docs/Web/API/FileList) and [`ReactNativeFile`](#react-native) instances anywhere within mutation or query input variables. With the [`apollo-upload-server`](https://github.com/jaydenseric/apollo-upload-server) middleware setup on the GraphQL server, files upload to a configurable temp directory. `Upload` input type metadata replaces the original files in the arguments received by the resolver.

Checkout the [example API and client](https://github.com/jaydenseric/apollo-upload-examples).

Use [`apollo-upload-client`](https://github.com/jaydenseric/apollo-upload-client) for earlier versions of [`apollo-client`](https://github.com/apollographql/apollo-client) that do not support an [`apollo-fetch`](https://github.com/apollographql/apollo-fetch) network interface.

## Setup

Install with [npm](https://www.npmjs.com):

```
npm install apollo-fetch-upload
```

To setup an [`ApolloClient`](http://dev.apollodata.com/core/apollo-client-api.html#apollo-client) network interface:

```js
import ApolloClient from 'apollo-client'
import { createApolloFetchUpload } from 'apollo-fetch-upload'
import { print } from 'graphql/language/printer'

const apolloFetchUpload = createApolloFetchUpload({
  uri: 'https://api.githunt.com/graphql'
})

const ApolloClient = new ApolloClient({
  networkInterface: {
    query: request => apolloFetchUpload({
      ...request,
      query: print(request.query)
    })
  }
})
```

Alternatively use query batching:

```js
import ApolloClient from 'apollo-client'
import BatchHttpLink from 'apollo-link-batch-http'
import { createApolloFetchUpload } from 'apollo-fetch-upload'

const ApolloClient = new ApolloClient({
  networkInterface: new BatchHttpLink({
    fetch: createApolloFetchUpload({
      uri: 'https://api.githunt.com/graphql'
    })
  })
})
```

`createApolloFetchUpload` and `constructUploadOptions` have the same [API](https://github.com/apollographql/apollo-fetch#api) as `createApolloFetch` and `constructDefaultOptions` in [`apollo-fetch`](https://github.com/apollographql/apollo-fetch).

See also the [setup instructions](https://github.com/jaydenseric/apollo-upload-server#setup) for the [`apollo-upload-server`](https://github.com/jaydenseric/apollo-upload-server) middleware.

## Usage

Use [`File`](https://developer.mozilla.org/en/docs/Web/API/File), [`FileList`](https://developer.mozilla.org/en/docs/Web/API/FileList) or [`ReactNativeFile`](#react-native) instances anywhere within mutation or query input variables. For server instructions see [`apollo-upload-server`](https://github.com/jaydenseric/apollo-upload-server). Checkout the [example API and client](https://github.com/jaydenseric/apollo-upload-examples).

### [`File`](https://developer.mozilla.org/en/docs/Web/API/File) example

```jsx
import { graphql, gql } from 'react-apollo'

const UploadFile = ({ mutate }) => {
  const handleChange = ({ target }) =>
    target.validity.valid &&
    mutate({
      variables: {
        file: target.files[0]
      }
    })

  return <input type="file" required onChange={handleChange} />
}

export default graphql(gql`
  mutation($file: Upload!) {
    uploadFile(file: $file) {
      id
    }
  }
`)(UploadFile)
```

### [`FileList`](https://developer.mozilla.org/en/docs/Web/API/FileList) example

```jsx
import { graphql, gql } from 'react-apollo'

const UploadFiles = ({ mutate }) => {
  const handleChange = ({ target }) =>
    target.validity.valid &&
    mutate({
      variables: {
        files: target.files
      }
    })

  return <input type="file" multiple required onChange={handleChange} />
}

export default graphql(gql`
  mutation($files: [Upload!]!) {
    uploadFiles(files: $files) {
      id
    }
  }
`)(UploadFiles)
```

### React Native

Substitute [`File`](https://developer.mozilla.org/en/docs/Web/API/File) with `ReactNativeFile` from [`extract-files`](https://github.com/jaydenseric/extract-files):

```js
import { ReactNativeFile } from 'apollo-fetch-upload'

const variables = {
  file: new ReactNativeFile({
    uri: /* Camera roll URI */,
    type: 'image/jpeg',
    name: 'photo.jpg'
  }),
  files: ReactNativeFile.list([{
    uri: /* Camera roll URI */,
    type: 'image/jpeg',
    name: 'photo-1.jpg'
  }, {
    uri: /* Camera roll URI */,
    type: 'image/jpeg',
    name: 'photo-2.jpg'
  }])
}
```

## How it works

An ‘operations object’ is a [GraphQL request](http://dev.apollodata.com/tools/graphql-server/requests.html#postRequests) (or array of requests if batching). A ‘file’ is a [`File`](https://developer.mozilla.org/en/docs/Web/API/File) or [`ReactNativeFile`](#react-native) instance.

When an operations object is to be sent to the GraphQL server, any files within are extracted using [`extract-files`](https://github.com/jaydenseric/extract-files), remembering their object paths within request variables.

If no files are extracted a normal fetch with default options happens; the operations object is converted to JSON and sent in the fetch body.

Files must upload as individual multipart form fields. A new [`FormData`](https://developer.mozilla.org/en/docs/Web/API/FormData) form is created and each extracted file is appended as a field named after the file's original operations object path; for example `variables.files.0` or `0.variables.files.0` if batching. The operations object (now without files) is converted to JSON and appended as a field named `operations`. The form is sent in the fetch body.

Multipart GraphQL server requests are handled by [`apollo-upload-server`](https://github.com/jaydenseric/apollo-upload-server) middleware. The files upload to a temp directory, the `operations` field is JSON decoded and [`object-path`](https://github.com/mariocasciaro/object-path) is used to insert metadata about each of the uploads (including the temp path) in place of the original files in the resolver arguments.
