# Lib
This is a monorepo containing a number of packages, a web client, and CLI tools. 

## Packages
The main focus of this repository is its collection of versatile packages. Being a curated collection, there is a strong focus on, and certain philosophies that apply to, particular qualities of each package:

* **Cohesion**
  
  *Code should mingle*. The most important aspect of the libraries in this repository is how they enhance, complement, and interact. By design, the libraries use as many common libraries and/or utilities as possible; primarily to standardize APIs, secondarily to optimize bundle sizes and simplify library code. Libraries should all expose API surfaces that are consistent, intuitive, and flexible when used individually and together. Use of third party libraries in package development is not discouraged, but in order to retain as much control over the codebase as possible, custom solutions are prioritized. Of course, this does not apply to development dependencies, where use of established tools is highly encouraged.

* **Cleanliness**
  
  *Code should be clean*. Whether in a library or in an application, libraries should encourage and support clean, declarative, and intuitive code. The packages in this repository are constantly updated to remain structurally polished, syntactically precise, and logically sound. Code is often revised to optimize performance, augment abstraction, increase interoperability, and/or to become more semantically concise. All code should be written primarily with this in mind, as to keep it optimally maintainable. Rushed solutions get shunned.

* **Performance**
  
  *Code should be fast*. While cleanliness and the maintainability to which it is conducive is paramount, performance is a very important aspect that should not be taken lightly. At times, it may be necessary, or even encouraged, to sacrifice some cleanliness for performance. For instance, it can be seen how this applies to loop constructs in all libraries. While usually far from a significant performance bottleneck, loop constructs are clear enough on their own to warrant their small performance benefit in exchange for some added mental overhead, warranted by the fact that library code is likely to be run much more often than application code. The closer to the silicon, the more lenient the demand for squeaky clean code. Overall, however, performance should be a complement to a clean codebase and not the other way around. Performance optimization should primarily be done through careful selection of appropriate algorithms, as well as in situ when written, assuming it is done in an unobtrusive manner. For instance, leveraging short-circuit evaluation is a relatively unobtrusive method of cutting clock cycles.

* **Development Mindset**
  
  *Code should ideally be written once*. This is not a fixed rule, but it hints at a pervasive philosophy that applies to development of all packages. Purposeful code is always the focus, and the end product should be user friendly, scalable, maintainable, and predictable. In development, this is done by constantly having the structure and performance of the product in mind. Ideally, large parts of the code should be open to be be interpreted in terms of abstract features, where the developer can dive into individual parts as needed whereupon more technical detail can be studied for continued development. Again, keeping the codebase clean is imperative for this to work.

* **Code Style and Paradigms**
  
  Largely, the code in this repository follows the recommended style guide as imposed by ESLint, and in great parts the [Airbnb](https://github.com/airbnb/javascript) and [Google](https://google.github.io/styleguide/jsguide.html) JavaScript style guides. There are a number of deviations from these style guides, which are documented in the [Stylistic Choices](#user-content-stylistic-choices) section.

  Code should have high cohesion and loose coupling. When within a single library, and moreso a single file, coupling is often slightly tighter. This is primarily done to keep the code compact and DRY. Libraries themselves, however, must never be tightly coupled. When applicable, the dependency inversion principle should be applied. The benefits of this are twofold; firstly, it increases flexibility and testability, and secondly, it potentially reduces the inherent dependency tree and bundle size of the package itself.

  In general, code is written in a hybrid style. Imperative/OOP programming makes up the foundational layer of most libraries. On top of this, general FP patterns are applied where applicable. In order to optimize performance, the core library components are often mutable and OOP-based. However, immutability, pure functions, and in some cases composition are often sought after as properties that apply to other parts of the libraries and are used when possible.

  That being said, libraries always strive to expose a declarative API surfaces, with strong focus on flexibility, extensibility, and instantiation/creation with sensible defaults. Some optionally support immutable usage as well.

* **Testing**
  
  Testing is primarily done with Jest, with simple unit testing being prioritized in most cases. Tests are put in the `/test` directory in each package.

* **Building**
  
  There are plans for adding a robust multi-target build step, although none are available at present.

---

## Web Client
Lib comes supplied with a basic web client. When run, a server is set up with a process that monitors changes, then builds and serves the libraries to the client. The pages for the individual packages can be found at `HOST/package-name`.

Each library has a `/connect` directory. In it, the system looks for a `feed.js` file, which is used as the entry point for the public bundle. In it, a `feed` reference is provided. When called as a function, passed library contents are exposed. Under the hood, this is collated into one output object. This output object, and its contents, are made globally available on the package page. Furthermore, it is possible to add individual references to the output using `feed.add`. Provided with a name and a resolver callback, any data can be added to the output. In addition to this, example usage can be provided using `feed.example`. Provided with an example name and a configuration object, usage samples can be run in the console. To view a sample usage of both these features, check out `@qtxr/i18n/connect/feed.js`.

---

## CLI
Lib provides a basic command-line tool. This is made available as `ql` and `qlib`. Below are a few use cases for this tool:

* **Package Init**
  
  Using `ql init`, a new package can be initialized. Provide a package name, and optionally the `--verbose` flag for fine-grained initialization, and a form will be presented to complete setup.

* **Git Pushing**
  
  Using `ql git push` or its alias `ql p`, the contents of the current package will be pushed to a remote server. Along with this, the commit will be provided additional information for identification purposes.

* **WEBP**
  
  Using `ql webp`, image contents of a directory can be cloned into a new directory with WEBP assets.

---

## Behavioral Choices
There are plenty of opportunities to impress a unique style to libraries as they are developed. The packages in this repository certainly do so. However, these special features always have a few things in common:

1. They must be unobtrusive. A feature must never incur mental overhead or confusion. If that happens, the feature must either be revised to be more clear in vision, or removed altogether.
2. They must be consistent. Features and behaviors are pervasive throughout the repository and its ecosystem. The developer should readily notice patterns in the systems, knowing that there are measured choices underpinning their design.

* **Arguments Can be Resolved**
  
  Several libraries and utility functions utilize `@qtxr/utils/resolveArgs`. This function goes hand in hand with a fundamental principle that applies throughout the repository: supporting developer convenience and conveying intent. Functions that are intuitive and have a clear focus also have parameters that make logical sense from typing alone. At the same time, however, some functions may support enough arguments that calling them by plain arguments alone becomes cumbersome and nonidomatic in certain cases. That is why `resolveArgs` was created. Using this utility function, it is possible to create functions that accept plain arguments or singular argument objects, all while providing typing. The goal is to give the developer the option to call a function with arguments that make sense. Say, a function may accept arguments `a-d`. Assume that in some cases, `b-d` are irrelevant arguments. If so, it makes sense to call the function with a singular argument `a`, all the while calling it with an argument object could be considered needlessly verbose. In another case, `d` might be a required parameter. Instead of awkwardly padding arguments `b-c` with null values or similar, an argument object should be used instead. To further avoid confusion, arguments can be strictly enforced, throwing an error elaborating what caused the error and what correct function usage looks like, should malformed data be passed.

* **Functions Should be Readily Configurable**
  
  Another central component in the API layer of many utilities and components is configurability, achieved by us of `@qtxr/utils/options`. If the behavior of a function can be altered by the caller, then the callee should support configuration on the forms `@qtxr/utils/options` supports. `@qtxr/utils/options` is a simple system that manages options generation and management. Options templates are created using `composeOptionsTemplates` by passing an object containing named options. If a property is not an object, the property key will be used as an option field, with the property value passed as the field value. For example, `{ circular: true }` becomes `{ circular: { circular: true } }`. This is particularly useful in situations where boolean flags are desired options. The templates emitted by `composeOptionsTemplates` are immutable to avoid tampering. Then, options are resolved using `createOptionsObject`. This function returns an options object, and for externally facing APIs, they are always frozen and lack prototypes. Since `composeOptionsTemplates` can only consume options to create a new object, other data is treated as follows:
  
  Strings are references to templates. `"circular"` becomes `{ circular: { circular: true } }`. It is also possible to group references like so: `"circular|otherRef"`. In this case, `otherRef` is an unknown template. To avoid any hard-to-track bugs arising from this, an error is logged to the concole whenever an unknown template is referenced. Together with this, a list of valid templates is logged for reference.

  Arrays are considered as options containers. Internally, arrays are flattened before their contents get merged with the output object.

* **null Before Errors**
  
  Almost exclusively, functions terminate. Errors are few and far between. The reasoning is straight-forward; errors must be caught. There is rarely a benefit to letting code crash under normal circumstances. Therefore, handling errors is an important aspect of any system. However, the libraries in this repository do not generally throw errors. Instead, they return `null`. The reason they do this is as follows; returning `null` signals that a function has terminated but explicitly without producing a useful result. Upon receiving such a value, the caller may decide on different routes of action, be it returning `null` itself, providing a sensible default value, or indeed throwing an error. The greatest benefit to this is that there is no need to wrap sections of code in try-catch blocks, giving the developer more fine-grained control over error handling. There is of course concern about a returned `null` value being ambiguous, both in terms of not giving a reason as to the source of error, as well as being a singular value without inherent concrete meaning within the JS runtime. However, these issues have been found to be rare, all but nonexistent, as functions should always have one responsibility and thus a single reason to fail. Furthermore, a function returning `null` is rare since the value lacks any general meaning other than the absence of a value.

* **Errors Are Fatal**
  
  When errors are thrown, they are thrown for good reasons. They happen first and foremost when data is impossible to work with. Systems using the libraries found in this repository are expected to strictly enforce good typing in the program flow, either implicitly by strategically placed type checks, or explicitly using a language that supplies a typing system. Hence, errors are assumed to occur when something has gone very wrong within the program, to the point that proceeding is not feasible or downright detrimental. That being said, throwing errors is not discouraged in general. The developer is responsible for moderating what data to expect, and what quality data should be allowed to pass through the system.

---

## Stylistic Choices
The following are style choices that diverge or differ to some extent, however small, from common style guides (in this case Airbnb). Code should never diverge too far from best practice formatting, but neither should the developer be held to a fixed set of rules. However menial the differences are to common style guides, the importance of applying a pragmatic mindset to code style is impressed on the developer, who is first and foremost responsible for producing a legible and elegant product. If in a certain case diverging from fixed rules means the code becomes more pleasant to read, this is preferred. Perhaps all of this goes without saying, but for transparency reasons, these are the main cases where rules have been found to be fuzzy:

<details>
  <summary>
    <b>
      <a href="https://github.com/airbnb/javascript#objects--grouped-shorthand">3.5</a>
      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
      Group your shorthand properties at the beginning of your object declaration
    </b>
  </summary>

  As a general rule, the most pertinent data to the object receives priority over other data, and is put at the top. Similarly, grouping of properties with similar characteristics is also preferred over shorthand definitions.
</details>

<details>
  <summary>
    <b>
      <a href="https://github.com/airbnb/javascript#objects--rest-spread">3.8</a>
      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
      Prefer the object spread operator over <code>Object.assign</code> to shallow-copy objects
    </b>
  </summary>

  `@qtxr/utils/assign` or `@qtxr/utils/inject` are favored over spread, as it is slighty more explicit in most cases. However, mutating the original data is almost always heavily discouraged and is never done except for explicit extensions.
</details>

<details>
  <summary>
    <b>
      <a href="https://github.com/airbnb/javascript#es6-array-spreads">4.3</a>
      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
      Use array spreads <code>...</code> to copy arrays
    </b>
  </summary>

  `Array.prototype.slice` or `Array.prototype.concat` are preferred over spread in most cases for cloning arrays. However, when creating new, non-trivial compound arrays, spread may still be freely used.
</details>

<details>
  <summary>
    <b>
      <a href="https://github.com/airbnb/javascript#arrays--from-iterable) / [4.5](https://github.com/airbnb/javascript#arrays--from-array-like) / [4.6](https://github.com/airbnb/javascript#arrays--mapping">4.4</a>
      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
      <code>Array.from</code> and spread
    </b>
  </summary>

  These operations are rarely done, as certain data is usually purposefully stored in a non-array format. Transforms such as these are actively discouraged for iteration. Use an explicit loop, a built-in prototype method, or `@qtxr/utils/forEach` as not to create unnecessary intermediate arrays.
</details>

<details>
  <summary>
    <b>
      <a href="https://github.com/airbnb/javascript#strings--quotes">6.1</a>
      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&thinsp;
      Use single quotes <code>''</code> for strings
    </b>
  </summary>

  Double quotes are preferred. While this is a purely stylistic choice, a double quote is marginally harder to confuse for a backtick character. Single quotes are used, however, in console logs, as they look slightly cleaner at a casual glance.
</details>

<details>
  <summary>
    <b>
      <a href="https://github.com/airbnb/javascript#functions--declarations">7.1</a>
      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&thinsp;
      Use named function expressions instead of function declarations
    </b>
  </summary>

  Top-level functions are almost exclusively written in function declaration form. Residing in one file, functions should have high cohesion but as a side effect often have slightly higher coupling between themselves. As such, oftentimes the functions reference and leverage each other to produce an effect. Therefore, such functions are seen as intrinsically interconnected and their internal use should not be thought of strictly sequential. In general, the main functions, or entry points, are placed at the top, with the supporting functions at the bottom, interwoven if there are multiple entry point functions.

  However, callback functions and closures should always be expressions, and preferably constructed using fat arrow notation.
</details>

<details>
  <summary>
    <b>
      <a href="https://github.com/airbnb/javascript#es6-default-parameters">7.7</a>
      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
      Use default parameter syntax rather than mutating function arguments
    </b>
  </summary>

  When feasible and sensible from a method signature point of view, always define defaults inline in the parameters. The main reason for breaking this rule is that it oftentimes becomes tricky to find a suitable alias for an argument. Therefore, in certain cases it is deemed okay to reassign an argument:

  1. If it does not conform to the desired type, when throwing an error is not desired.
  2. To apply processing to it. When this is done, keeping track of types is a priority.
  
  Argument modifications must happen at the start of a function or method, and must not include complex conditional modifications. In effect, the result of argument reassignments must leave the data in a state as if the function had been invoked with it in the first place. Once in the main function body, arguments must be regarded as constant and immutable, as this part of the function should remain ignorant of changes applied to its data. The exception is when a function is created with the explicit purpose of modifying a passed object (see: [7.12](https://github.com/airbnb/javascript#functions--mutate-params)).
  
  At no point do processing in default parameters (see also: [7.8](https://github.com/airbnb/javascript#functions--default-side-effects)).
</details>

<details>
  <summary>
    <b>
      <a href="https://github.com/airbnb/javascript#functions--constructor">7.10</a>
      &nbsp;&nbsp;&nbsp;&nbsp;
      Never use the Function constructor to create a new function
    </b>
  </summary>

  Creating functions is allowed, but great care must be taken to ensure injection cannot occur. Function construction is used by some libraries (chiefly in `@qtxr/utils/mkCharacterSet`, `@qtxr/utils/matchType` and `@qtxr/utils/matrix/#codegenMul`) to optimize performance in well defined, dynamic situations. All of them impose strict restrictions on what can be input and will fail if data is not provided in the correct form. The burden of assuring data is safe to use lies on the implementer.
</details>

<details>
  <summary>
    <b>
      <a href="https://github.com/airbnb/javascript#arrows--one-arg-parens">8.4</a>
      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
      Always include parentheses around arguments for clarity and consistency
    </b>
  </summary>

  For purely aesthetic reasons, single parameter functions are not wrapped in parentheses. Similarly, 0-parameter functions use `_` in lieu of `()` for terseness. The underscore also often signifies that the caller does not intend to provide any arguments to the callee.
</details>

<details>
  <summary>
    <b>
      <a href="https://github.com/airbnb/javascript#modules--no-export-from-import">10.3</a>
      &nbsp;&nbsp;&nbsp;
      Do not export directly from an import
    </b>
  </summary>

  These exports are found almost exclusively in aggregation modules. As such, their intent is clear enough to warrant the shorthand form.
</details>

<details>
  <summary>
    <b>
      <a href="https://github.com/airbnb/javascript#modules--import-extensions">10.10</a>
      &nbsp;
      Do not include JavaScript filename extensions
    </b>
  </summary>

  This rule strictly applies to `.js`, `.mjs`, and `.cjs` modules only. All other files should be given an extension for the sake of clarity (see: `.vue`).
</details>

<details>
  <summary>
    <b>
      <a href="https://github.com/airbnb/javascript#variables--one-const">13.2</a>
      &nbsp;&nbsp;&nbsp;
      Use one <code>const</code> or <code>let</code> declaration per variable or assignment
    </b>
  </summary>

  Combined with a linter, combining multiple declarations into one statement arguably looks cleaner and more organized, and modern debuggers can step through each sub-statement individually. Only exception is when using `await` syntax within an assignment.
</details>

<details>
  <summary>
    <b>
      <a href="https://github.com/airbnb/javascript#variables--unary-increment-decrement">13.6</a>
      &nbsp;&nbsp;&thinsp;
      Avoid using unary increments and decrements
    </b>
  </summary>

  Using these specific operators conveys the intent to change a number by a constant amount and is considered a semantic benefit.
</details>

<details>
  <summary>
    <b>
      <a href="https://github.com/airbnb/javascript#comparison--eqeqeq">15.1</a>
      &nbsp;&nbsp;&nbsp;&thinsp;
      Use <code>===</code> and <code>!==</code> over <code>==</code> and <code>!=</code>
    </b>
  </summary>

  Code should always be robust enough not to accept values of the wrong type. A bug occuring in a loose comparison is likely indicative of a bigger problem wherein incompatible data is allowed to flow through the system unimpeded. When explicitly used, strict comparisons convey that there is a good chance that valid data may erroneously match an expression, and that care has been taken to prevent such an eventuality.
</details>

<details>
  <summary>
    <b>
      <a href="https://github.com/airbnb/javascript#blocks--braces">16.1</a>
      &nbsp;&nbsp;&nbsp;&thinsp;
      Use braces with all multiline blocks
    </b>
  </summary>

  Single line blocks are always written on two lines, with the body on the second, indented line. This is because adding braces adds unnecessary bloat, and writing a block in a single line makes it more difficult to spot that a special code space is reached. Bugs arising from incorrect use of this syntax are considered rare and unlikely to happen with thorough testing and attention to code structure. However, whenever more than one line is used in a block, brackets are used, even if not strictly necessary (e.g. `for { if / expr }` over `for / if / expr`).
</details>

<details>
  <summary>
    <b>
      <a href="https://github.com/airbnb/javascript#control-statements">17.1</a>
      &nbsp;&nbsp;&nbsp;&nbsp;&thinsp;
      If a control statement gets too long, put each condition on a new line. The logical operator should begin the line
    </b>
  </summary>

  Only difference here is that operators are put last on preceding lines, as the terms of the statement are likely the main focus of the operation. This rule stems primarily from its use in split-line ternary expressions.
</details>

<details>
  <summary>
    <b>
      <a href="https://github.com/airbnb/javascript#whitespace--spaces">19.1</a>
      &nbsp;&nbsp;&nbsp;&thinsp;
      Use soft tabs (space character) set to 2 spaces
    </b>
  </summary>

  Mostly irrelevant in the grand scheme of things, but tabs offer greater flexibility than spaces in most cases, and may provide benefits to accessibility. Spaces are not used for alignment for similar reasons. 4-space tabs are used throughout the repository.
</details>

<details>
  <summary>
    <b>
      <a href="https://github.com/airbnb/javascript#commas--dangling">20.2</a>
      &nbsp;&nbsp;
      Additional trailing comma
    </b>
  </summary>

  Unnecessary code is unnecessary. For the purposes of this repository, diffs are not a major concern, and leaving a dangling comma can look sloppy.
</details>

<details>
  <summary>
    <b>
      <a href="https://github.com/airbnb/javascript#naming--leading-underscore">23.4</a>
      &nbsp;&nbsp;
      Do not use trailing or leading underscores
    </b>
  </summary>

  Members intended to be left alone (in effect private), are denoted with a single leading underscore. In certain applications, such as `@qtxr/url`, `WeakMap`s are still used where available to provide de facto private members.
</details>

<details>
  <summary>
    <b>
      <a href="https://github.com/airbnb/javascript#naming--filename-matches-export">23.6</a>
      &nbsp;&nbsp;
      A base filename should exactly match the name of its default export
    </b>
  </summary>

  Files are always named in `kebab-case`. Names are converted from `PascalCase` (classes) or `camelCase` (functions, etc.) to `kebab-case` letter by letter.
</details>

<details>
  <summary>
    <b>
      <a href="https://github.com/airbnb/javascript#accessors--no-getters-setters24.2">24.2</a>
      &nbsp;&nbsp;
      Do not use JavaScript getters/setters
    </b>
  </summary>

  Getters/setters are used sparsely, and purposefully, for externally facing APIs. They should be used primarily for operations that run in constant time, and have minimal side effects, if any. Internally facing API code should avoid using them as much as possible both for performance reasons and potential issues with internal reflection in code paths, where getter/setter calls are being made left and right in a potentially uncontrollable and wholly unintuitive fashion.
</details>

<details>
  <summary>
    <b>
      <a href="https://github.com/airbnb/javascript#standard-library--isnan) / [29.2](https://github.com/airbnb/javascript#standard-library--isfinite">29.1</a>
      &nbsp;&nbsp;&nbsp;
      The Standard Library contains utilities that are functionally broken but remain for legacy reasons
    </b>
  </summary>

  To avoid issues with backwards compatibility, it is often easier to add a `typeof` check along with use of `isNaN` / `isFinite` instead of supplying a polyfill or creating a small utility function. While not scalable, these methods are rarely used, and so usually creating something more robust is not needed.
</details>
