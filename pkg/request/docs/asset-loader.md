# AssetLoader

AssetLoader is a standard library for loading assets of any type. The library is mainly meant to facilitate loading of modules, that is, assets that may request other modules.

---

## Processors
To create a standard interface that is flexible and customizable, AssetLoader defines and uses processors. Processors are hooks that transform and process data for use internally or by the client using the loader. AssetLoader does not catch errors thrown within procssors.

Every processor receives the following arguments:

* **loader `AssetLoader`**
  
  The current AssetLoader instance

* **path `string`**

  The path for the current requested resource. For the path processor, this may not be a formatted name, but for any other processor this argument is the processed name from the path processor

* **arguments `...any[]`**
  
  Any number of applicable arguments

Below are the default processors the library uses.

* **path** `(loader, path) -> path`
  
  Processes paths so that all assets are requested in a uniform way. By default, this is an identity processor (returns its input). The path may also be any valid URI. Please also note that this function should be idempotent, as AssetLoader may need to process paths multiple times. For similar reasons, and for consistency in general, it's recommended that this processor is never overwritten. This is because, among other things, it's used internally to identify enqueued assets.
* **prefetchResponse** `(loader, path, response: response node) -> response: any`
  
  Processes response data from prefetch. The response argument is parsed response data straight from the XHR loader wrapped in a response node. The returned value from this is passed as the resolved value. By default, this is an identity processor that warns if an asset wasn't properly loaded.
* **fetchResponse** `(loader, path, response: response node) -> response: any`
  
  Processes response data from fetch. The response argument is parsed response data straight from the XHR loader wrapped in a response node. The returned value from this is passed as the resolved value. By default, this is an identity processor that warns if an asset wasn't properly loaded.
* **xhrSettings** `(loader, path, settings: Object) -> settings: object | null`
  
  Processes settings to be passed to the XHR loader. By default, this processor returns the input, or an empty object if a falsy input is given.
* **dependencies** `(loader, path, dependent: response node) -> dependencies: string[] | null`
  
  Processes dependencies given a dependent. The dependent is a response node and the processor will not be invoked when a dependency wasn't successfully fetched. This method must return an array of paths or URIs (processed or unprocessed) or else no dependencies will be loaded. When processsed, the loaded asset is wrapped in an asset node (see below). When the dependency has been loaded, it's appended to the `dependecies` property of the asset node. By default, this processor returns the `dependencies` property of the dependent's payload.
* **assetNode** `(loader, path, node: asset node, dependent: response node) -> node: asset node`
  
  Processes asset node data. This processor should modify the provided node or return a structurally similar node. By default, this is an identity processor.

## Fetch methods
The following methods are the core fetch methods. They accept at most four arguments. These arguments are resolved internally with `resolveArgs@qtxr/utils`, so individual arguments may be safely omitted. Alternatively, a single argument object may be passed with the keys corresponding to the respective arguments. These methods accept a `processors` object as the last argument. These may temporarily override the current processors.

The following methods all return a promise that resolves to a response node:

### prefetch `(path, settings?: object, lazy?: boolean, processors?: object) -> promise<response node>`
Prefetched assets have precedence over fetched assets. No new fetches are made before all queued prefetches have completed. Fetches initiated before any prefetch call are still completed.

### fetch `(path, settings?: object, lazy?: boolean, processors?: object) -> promise<response node>`
Fetch an asset without dependencies.

### fetchModule `(path, settings?: object, lazy?: boolean, processors?: object) -> promise<response node>`
Fetch a module and all its dependencies. Returns an error object if any asset fails to load. The `cached` property is true if and only if all assets are cached.

---

## Other methods
Below are miscellaneous (utility) methods: 

### #traverse `(rootNode: asset node, callback(node, rootNode, depth: number), tail?: boolean) -> success`
Traverses an assetNode and its dependencies. It only visits each node once, to properly handle circular references. Gracefully fails if the provided assetNode isn't an asset node or if the callback is not a function and returns `false`. Otherwise returns `true`. If the `tail` flag is truthy, the traversal is tail recursive.

### requestIdle `(callback: function, ...args)`
Requests a callback to be called whenever the loader is idle, i.e. not buffering prefetches. Returns a promise that resolves to the returned value from the callback.

### untilIdle
Returns a promise that resolves once the loader is idle, primarily meant to be used with `await` for sleep functionality. The resolved value is the time, in milliseconds, that has elapsed between invocation and resolve.

### isRequested `(path, processors?: object) -> boolean`
Returns true if a request has been initiated with the path. The path will be processed within this function.

### isEnqueued `(path, processors?: object) -> boolean`
Returns true if a request is currently enqueued with the path. The path will be processed within this function.

### isSuccessful `(path, processors?: object) -> boolean`
Returns true if there's a request that's successfully completed with the path. The path will be processed within this function.

### isFailed `(path, processors?: object) -> boolean`
Returns true if there's a request that's currently failed with the path. The path will be processed within this function.

### isAny `(path, ...keys: string[], processors?: object) -> boolean`
Applies tests for `requested`, `enqueued`, `successful`, and `failed` (analogous with the functions above). Returns true if any test returns true. The path will be processed within this function.

### isAll `(path, ...keys: string[], processors?: object) -> boolean`
Applies tests for `requested`, `enqueued`, `successful`, and `failed` (analogous with the functions above). Returns true if all tests return true. The path will be processed within this function.

---

## Internal methods
The below methods are primarily meant to be used internally, but can also be used by third parties:

### _fetch `(path, settings?: object, lazy?: boolean, processors?: object) -> promise<response node>`
The internal interface used to fetch data. Calling this method directly will not buffer requests if the async buffer is active, nor will arguments be resolved automatically.

### bufferAsync `(bufferPartition: string, callback(...args) -> promise, ...args) -> promise<callback return>`
This method buffers fetches for later use. The bufferPartition may be any of the following:

* prefetch
  
  Buffer to prefetch queue, where prefetching will be done sequentially until the queue is empty.
* fetch
  
  Buffer to no fetch queue, which will run all fetches in parallel.

The callback must return a promise that resolves to the return value. This value will then be used to resolve the promise returned by bufferAsync itself. The arguments passed will be applied to the function, with the loader instance as the context value.

### resumeAsync
This method runs buffered async tasks. This is called internally automatically and it's unlikely that third parties should need to use it.

### _logPath `(path)`
Adds the supplied path to objects tracking requested, loaded, failed, and active fetches. The supplied path will not be processed.

The tracked fields are as follows:

* requested
  
  Set when an asset is requested, regardless of if the request gets buffered or if the request is successful.
* enqueued
  
  Set when an asset is requested, regardless of if the request gets buffered. Unset when the request finishes, successful or not.

* successful
  
  Set when an asset successfully loads. 

* failed
  
  Set when an asset fails to load. Unset if it successfully loads.

---

## Fetch response node
Fetch response nodes have the following structure:

	{
		payload			// response data; null if fetch failed
		cached			// whether a cached payload is returned
		success			// fetch success

		// Internal data; do not modify
		isResponseNode: true	// identifying flag
	}

---

## Asset node
Asset nodes have the following structure and default values:

	{
		item: dependent			// loaded dependent asset
		dependencies: []		// loaded dependency assets will be appended here
		locale: null			// lower case IETF string for internationalization
		name: null			// asset name
		path				// processed path used to access resource

		// Internal data; do not modify
		isAssetNode: true		// identifying flag
		id				// sequentially assigned node ID, used to distinguish circular references
	}
