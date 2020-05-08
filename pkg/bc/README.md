## @qtxr/bc

Base classes that provide basic and standard functionality to any class that extends them.

#### Philosophy
bc is meant to provide versatile and robust classes that are open to be extended and mixed in any way seen fit. However, to reduce mental overhead and to provide stable, pluggable, and readable APIs, classes should follow these general rules:

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
	* The configuration object may assign configuration to base classes via addressed partitions. For instance, `{ hookable: { config } }` will assign configuration to an instance/mixin instance of Hookable.
	* By only accepting a single well defined argument, many base classes may be collected into mixin classes.
	* Extended classes will only ever have to call `super` and not worry about details in superclass construction.

4. Fields should be memorable and unique:
	* Classes should not initialize many data fields. Optimally, there should be at most one field that is set in the constructor. This is done to limit the risk of name collisions for data.
	* Classes should define sensible method names. Readers should be able to figure out which base class is being used for any call or data reference.
	* Methods should have unique names. This is a continuation of the above rule, but nonetheless it's important to make sure that methods won't accidentally be overwritten by another base class or subclass.

5. Subclasses may override the methods provided by base classes, but they should follow these rules:
	* Overridden methods should always call the super method at some point.
	* They should return the same type of data that the super method returns and provide the same capabilities that the base class provides. This is not a hard set rule. In general, consistency should be in focus, but when deviating from the super implementation details offers a cleaner or more powerful API, this is more important.

### Hookable
`Hookable` provides an interface for hooking into instances in an observer-like way. It also manages hook lifecycles and offers a terse API for painless hooking and messaging.

* Dependents hook into the subject using `hookable.hook`.
* Subjects call `hookable.callHooks` and Hookable will automatically call all dependents with the supplied arguments.
* Hooks may be nicknamed and namespaced. This is to enable easy bulk invalidation/removal of hooks.
* Hooks may have their own automatic lifecycle. This is done with a time to live (TTL) value. When the handler has been called a set amount of times, the entire hook is automatically discarded.
* Hooks may define a guard function. This function receives the exact same arguments that the handler receives. If this function returns a falsy value, the associated handler will not be invoked and its lifecycle will not be altered.
* The context value as well as the first argument passed to handlers and guards is always the owner of the hook, i.e. the instance on which the hook was added.

### DeferredPromise
`DeferredPromise` abstracts (defers) a `Promise` so that other classes may be treated as asynchronous.
