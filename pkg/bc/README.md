## @qtxr/bc

Base classes that provide basic and standard functionality to any class that extends them.

#### Philosophy
bc is meant to provide versatile and robust classes that are open to be extended in any way seen fit. However, to reduce mental overhead and to provide stable, pluggable, and readable APIs, classes should follow these general rules:

1. Constructors should not accept arguments:
   * By not accepting arguments, many base classes may be collected into mixin classes
   * Extended classes will only ever have to call `super` and not worry about details in superclass construction
2. Fields should be memorable an unique:
	* Classes should not initialize many data fields. Optimally, there should be at most one field that is set in the constructor. This is done to limit the risk of name collisions for data
	* Classes should define sensible method names. Readers should be able to figure out which base class is being used for any call or data reference
	* Methods should have unique names. This is a continuation of the above rule, but nonetheless it's important to make sure that methods won't accidentally be overwritten by another base class or subclass
3. Subclasses may override the methods provided by base classes, but they should follow these rules:
   * Overridden methods should always call the super method at some point
   * They should return the same type of data that the super method returns and provide the same capabilities that the base class provides. In other words, the rules of Liskov substitution should specifically apply
4. bc classes can be used as mixins, hence the importance of careful method naming and zero argument constructors

### Hookable
Hookable provides an interface for hooking into instances in an observer-like way. It also manages hook life cycles and offers a terse API for painless hooking and messaging.

* Dependents hook into the subject using `hookable.hook`
* Subjects call `hookable.callHooks` and Hookable will automatically call all dependents with the supplied arguments
* Hooks may be nicknamed and namespaced. This is to enable easy invalidation/removal of hooks when needed - in bulk
* Hooks may have their own automatic lifecycle. This is done with a time to live (TTL) value. When the handler has been called a set amount of times, the entire hook is automatically discarded