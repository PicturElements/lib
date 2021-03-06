# @qtxr/bc
Mixable base classes that provide consistent functionality to any class that extends them.

## Structure
bc provides versatile and robust classes that are open to be extended and mixed in any way seen fit. However, to reduce mental overhead and to provide stable, pluggable, and readable APIs, classes should follow these general guidelines:

1. Construction must happen within a special method:
	* Construction must not happen directly in the constructor, and should be deferred to a separate method called `Manager.CONSTRUCTOR`. Adding such a constructor is not necessary if no further construction is required. When invoked, this method will receive an options resolver function. Call it with any accessor and the corresponding configuration data, if available, will be returned. This configuration data is scoped to the class' namespace.
	* Furthermore, the constructor itself must invoke the constructor body with this:

		`Manage.instantiate(Class, instance, options);`,

		where `Class` is the class that is to be instantiated (eg. `Hookable`), `instance` is the instance that is currently being constructed (usually `this`), and `options` is the options argument passed to the constructor.

2. The class must declare what it should expose in a meta description:
	* Declaration is done with an invocation like so:

		`Manage.declare(Class, meta)`
		The meta object must contain the following:
		* name: `string` - the name of the class.
		* namespace: `string` - the namespace of the class. This is used internally to resolve constructors, options, etc.

		In addition, the meta object may contain the following:
		* extends: `Class | Class[]` - class(es) that the class will extend. These classes must also provide a meta description or else an error is thrown.
		* proto: `string[]` - prototype keys. Only prototypal members at these keys are used in mixins. If no prototypal member with the a provided key is found, an error is thrown.
		* static: `string[]` - static keys. Only static members at these keys are used in mixins. If no static member with a provided key is found, an error is thrown.
		* optionsTemplates: `object` - option teplates used to resolve passed options. The `Manage` helper collection uses `@qtxr/utils/options/createOptionsObject` under the hood.

3. Constructors must only accept a configuration object:
	* The configuration object may assign configuration to base classes via namespaced partitions. For instance, `{ hookable: { config } }` will assign configuration to an instance/mixin instance of Hookable.
	* By only accepting a single well defined argument, many base classes may be collected into mixin classes.
	* Extended classes will only ever have to call `super` and not worry about details in superclass construction.

4. Fields should be memorable and unique:
	* Classes should not initialize many data fields. Optimally, there should be at most one field that is set in the constructor. This is done to limit the risk of name collisions for data.
	* Classes should define sensible method names. Readers should be able to figure out which base class is being used for any call or data reference.
	* Methods should have unique names. This is a continuation of the above rule, but nonetheless it's important to make sure that methods won't accidentally be overwritten by another base class or subclass.

5. Subclasses may override the methods provided by base classes, but they should follow these rules:
	* Overridden methods should always call the super method at some point.
	* They should return the same type of data that the super method returns and provide the same capabilities that the base class provides. This is not a hard set rule. In general, consistency should be in focus, but when deviating from the super implementation details offers a cleaner or more powerful API, this is more important.

---

## Mixins
Base classes are all designed to be mixable. With the `mixin` function, any number of classes can be joined into one. The process of mixing in is performed for all associated classes and prototypes. The general algorithm is as follows:

For every provided class, its properties, prototype, and superclass are traversed, and a precedence map is produced. This map provides a reference to which order classes should be in in the prototype chain in a way that no methods or properties are overridden in the wrong order once an instance is created.

Then, a mixin class is generated by iterating up through the precedence map, and a single class is returned, ready for use, with the combined functionality of its parts.

---

## Classes

### Hookable
`Hookable` provides an interface for connecting to instances in an observer-like way. It also manages hook lifecycles and offers a terse API for painless hooking and messaging.

* Dependents hook into the subject using `hookable.hook`.
* Subjects call `hookable.callHooks` and Hookable will automatically call all dependents with the supplied arguments.
* Hooks may be nicknamed and namespaced. This is to enable easy bulk invalidation/removal of hooks.
* Hooks may have their own automatic lifecycle. This is done with a time to live (TTL) value. When the handler has been called a set amount of times, the entire hook is automatically discarded.
* Hooks may define a guard function. This function receives the exact same arguments that the handler receives. If this function returns a falsy value, the associated handler will not be invoked and its lifecycle will not be altered.
* The context value as well as the first argument passed to handlers and guards is always the owner of the hook, i.e. the instance on which the hook was added.

### DeferredPromise
`DeferredPromise` abstracts (defers) a `Promise` so that other classes may be treated as asynchronous.

* `DeferredPromise` exposes the same API as normal `Promise`s, both for instance and static methods.
* Instances expose a `dispatchPromise` method which can be used to settle promise states.

### MixableArray
`MixableArray` is a trivial class that can be provided as a mixin. The use of this is primarily semantic, as it's possible to simply supply the Array constructor directly, assuming it's the only external class provided.

### Stator
`Stator` is a state management class. It manages setting, updating, diffing, transforming, and communication of state.

* State is added to the instance using the `setState` method. Upon this, state is set and the `Stator` object is returned. However, if tracking flags are passed to the constructor via `track` (`{ track: { additions?, updates?, deletions? } }`) or via shorthands (`trackAdditions`, `trackUpdates`, `trackDeletions`, and `trackAll`), an array will be returned containing all actions taken on the state matching the provided flags.
* Changes to state can be listened to by hooking into the instance. Internally, `Stator` converts object accessors to URL-like paths. By this action, it offers full support of glob matching for hooks. For instance, `a.b.*` (or indeed `a.b[*]`) matches state at `a.b.c`.
* `Stator` supports state transforms. Transforms consume individual nodes in the state tree and set state as their target nodes are added or updated. Transforms can be defined individually at a specified accessor with the `addTransform` method, or in bulk using `addTransforms`. `Tranform` instances consist primarily of transform handlers. Handlers are provided with a singular runtime object containing the current and old values, as well as utility methods (`set`, `append`, and `merge`) for efficient transform application. `set` assigns state with respect to the root state node, `append` with respect to the current node, and `merge` with respect to the parent of the current node, effectively adding siblings to the target node. If an object is returned from the handler, `merge` will be used to set state. If a non-nullish value is returned, the target value will be updated to match the provided value. Else, no additional work is done. `set`, `append`, and `merge` all support the same syntax as `setState`.
