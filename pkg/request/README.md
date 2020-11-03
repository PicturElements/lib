# @qtxr/request
`@qtxr/request` is a collection of libraries facilitating HTTP requests. It adopts syntax from the `fetch` API, as well as more traditional `jQuery` callback chaining. It is highly extendable and customizable, and strives to provide solutions for both front-end and back-end applications.

In this document we will briefly outline the following libraries:

* `fetch` request client
* `XHRHttpRequest` request client
* `AssetLoader`

---

## Consistency
`@qtxr/request` provides request managers and instances thereof that are designed to follow the same API, and if possible implement missing or inconveniently implemented features from competing APIs. For instance, the `fetch`-based library has support for timeouts, download progress, and convenient aborting functionality. Similarly, the `XHRHttpRequest`-based implementation has support for most of what `Request` has to offer, besides also supporting `Promise`-based fetching.

---

## Managers, States, and Responses
Managers lie at the core of all provided request libraries. Their responsibility is to accept and process configuration (presets), set up request modes, and dispatch requests into states.

States allow callbacks to hook into them, and receive changes to be relayed and incorporated into the result. When the request has finished, a response object is emitted (resolved or rejected via built-in Promise functionality).

Responses provide an interface with which the client can access useful data pertinent to the request response. These response objects are heavily influenced by the `Response` class bundled by the `fetch` API, and provides much of the same functionality, even if the underlying request module doesn't support it.

---

## AssetLoader
AssetLoader is a standard library for loading assets of any type. The library is mainly meant to facilitate loading of modules, that is, assets that may request other modules. For more information, check out `/doc/asset-loader.md`.
