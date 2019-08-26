# AssetLoader

AssetLoader is a standard library for loading assets of any type. The library is mainly meant to facilitate loading of modules, that is, assets that may request other modules. 

### Processors
To create a standard interface that is flexible and customizable, AssetLoader defines and uses processors. Processors transform and process data for use internally or by the client using the loader.

Every processor receives the following arguments:

* loader
The current AssetLoader instance
* arguments
Any number of applicable arguments
* fileName
The file name for the current requested resource. For the fileName processor, this may not be a formatted name, but for any other processor this argument is the processed name from the fileName processor

Below are the default processors the library uses.

* **fileName** (loader, fileName)
Processes file names so that all assets are requested in a uniform way. By default, this is an identity processor (returns its input)
* **prefetchResponse** (loader, response, fileName)
Processes response data from prefetch. The response argument is parsed response data straight from the XHR loader. The returned value from this is passed as the resolve value. By default, this is an identity processor that warns if an asset wasn't properly loaded
* **fetchResponse** (loader, response, fileName)
Processes response data from fetch. The response argument is parsed response data straight from the XHR loader. The returned value from this is passed as the resolve value. By default, this is an identity processor that warns if an asset wasn't properly loaded
* **xhrSettings** (loader, settings, fileName)
Processes settings to be passed to the XHR loader. By default, this processor returns the input, or an empty object if a falsy input is given
* **dependencies** (loader, dependent, fileName)
Processes dependencies given a dependent. The dependent is the processed data from a fetch and the processor will not be invoked if no dependent asset was fetched. This method must return an array of file names (processed or unprocessed) or else no dependencies will be loaded. When processsed, the loaded asset is wrapped in an asset node (see below). When the dependency has been loaded, it's appended to the `dependecies` property of the asset node. By default, this processor returns the `dependencies` property of the dependent.
* **assetNode** (loader, node, dependent, fileName)
Processes asset node data. By default, this is an identity processor

## Fetching methods
The following methods are the core fetch methods. They accept at most four arguments. These arguments are resolved internally with `@qtxr/utils/resolveArg`, so arguments may be safely omitted. Alternatively, a single argument object may be passed with the keys corresponding to the respective argument. These methods accept a `processors` object as the last argument. These processors temporarily override the current processors.

### prefetch (fileName, settings, lazy, processors)
Prefetched assets have precedence over fetched assets. No new fetches are made before all queued prefetches have completed. A promise is returned that resolves to the fetched data.

### fetch (fileName, settings, lazy, processors)
Fetch an asset. A promise is returned that resolves to the fetched data.

### fetchModule (fileName, settings, lazy, processors)
Fetch a module. A promise is returned that resolves to an asset node with dependencies.

### Asset node
An asset node has the following structure and default values:

	{
		item: dependent,		// Loaded dependent asset
		dependencies: [],		// Loaded dependency assets will be appended here
		locale: null,			// lower case IETF string
		name: null,				// Asset name
		fileName: fileName,		// Full file name
		isAssetNode: true		// Identifying value; do not modify
	}
