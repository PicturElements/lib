# GetterManager

GetterManager is a basic class that generates, manages, and unifies assets. It provides a secure framwork through which to get any data.

## Directories and getter objects

GetterManager uses a directory system for various getters. This allows a single instance to manage an arbitrary amount of getters. In lieu of files, the leaf nodes of the GetterManager "file system" are Getter or GetterGroup instances.

### Getter

Basic getter class. Manages data and when to refresh caches.

### GetterGroup

Similar to Getter, but here getters are bound to their parent 

---

Getter or GetterGroup instances use data with this structure:

	{
		get		- getter function (Getter) / object of getters (GetterGroup); required
		cachePolicy	- when to get data anew, and when to return cached data; optional
		config		- configuration data; optional
		assets		- assets to be fed into resolvers; optional
	}

* get `function | object`

  Main getter function. This is run when data is requested and if the cache policy allows it. Otherwise, cached data is used.

* cachePolicy `string`

  Specifies when get() should be called. By default, whenever GetterManager.get is run, the get() function in the getter object is invoked. However, sometimes it may be better to cache returned data until it needs to be updated. cachePolicy allows this with the following modes:

  * none	- never cache (default)
  * permanent	- cache data permanently
  * same-config	- only get new data when no data has been cached with the specific configuration
  * same-assets - only get new data when no data has been cached with the specific assets
  * same-inputs - only get new data when no data has been cached with the specific configuration and assets

* config `object`

  Configuration used mainly when getting data. This serves as the default config for the getter. If additional configuration is supplied in the GetterManager.get call, this will be extended for the current get. Getter instances inherit configuration from GetterGroup instances.

* assets `object`

  Assets made accessible to getters and resolvers. For instance, utility functions may be defined here.  Getter instances inherit assets from GetterGroup instances.