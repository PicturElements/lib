*IMPORTANT*
The functions in this directory are resolved lazily so that dependents may properly polyfill functionality. Therefore, it's important not to use these functions within this package at root level. It's recommended that all polyfillable features that are referenced
at root level be lazily resolved