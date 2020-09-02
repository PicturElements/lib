# Lib
This is a monorepo containing a number of packages, a web client, and CLI tools. 

## Packages
The main focus of this repository is its collection of versatile packages. Being a curated collection, there is a strong focus on, and certain philosophies that apply to, certain qualities of each package:

* **Cohesion**
  
  Code should mingle. The most important aspect of the libraries in this repository is how they match, complement, and interact. By design, the libraries use as many common libraries and/or utilities as possible; primarily to standardize APIs, secondarily to optimize bundle sizes and simplify library code. Libraries should all expose API surfaces that are consistent, intuitive, and flexible when used individually and together. Use of third party libraries in package development is not discouraged, but in order to retain as much control over the codebase as possible, custom solutions are prioritized. Of course, this does not apply to development dependencies, where use of established tools is highly encouraged.

* **Cleanliness**
  
  Code should be clean. Whether in a library or in an application, libraries should encourage and support clean, declarative, and intuitive code. The packages in this repository are constantly updated to stay structurally polished, syntactically precise, and logically sound. Code is often revised to optimize performance, augment abstraction, increase interoperability, and/or to become more semantically concise. All code should be written primarily with this in mind, as to keep it optimally maintainable.

* **Performance**
  
  Code should be fast. While cleanliness and the maintainability to which it is conducive is paramount, performance is a very important aspect that should not be taken lightly. At times, it may be necessary, or even encouraged, to sacrifice some cleanliness for performance. For instance, it can be seen how this applies to loop constructs in all libraries. While usually not a significant performance bottleneck, loop constructs are clear enough on their own to warrant their small performance benefit in exchange for added mental overhead, warranted by the fact that library code is likely to run much more often than application code. The closer to the silicon, the more lenient the demand for squeaky clean code. Overall, however, performance should be a complement to a clean codebase and not the other way around. Performance optimization should primarily be done through careful selection of appropriate algorithms, as well as in situ when first written, assuming it is done in an unobtrusive way. For instance, leveraging short-cirquit evaluation is a relatively unobtrusive method of cutting clock cycles.

* **Development Mindset**
  
  Code should ideally be written once. This is not a fixed rule, but it hints at a pervasive philosophy that applies to development of all packages. Purposeful code is always the focus, and the end product should be user friendly, scalable, maintainable, and predictable. In development, this is done by constantly having the structure and performance of the product in mind. Ideally, large parts of the code should be open to be be interpreted in terms of abstract features, where the developer can dive into individual parts at will whereupon more technical detail can be studied for continued development. Again, keeping the codebase clean is imperative for this to work.

* **Code Style and Paradigms**
  
  Largely, the code in this repository follows the recommended style guide as imposed by ESLint, and in great parts the [Airbnb](https://github.com/airbnb/javascript) and [Google](https://google.github.io/styleguide/jsguide.html) JavaScript style guides. There are a number of deviations from these style guides, which are documented in the "Style Choices" section.

  Code should have high cohesion and loose coupling. When within a single library, and moreso a single file, coupling is often slightly tighter. This is primarily done to keep the code compact and DRY. Libraries themselves, however, must never be tightly coupled. When applicable, the dependency inversion principle should be applied. The benefits of this are twofold; firstly, it increases flexibility and testability, and secondly, it potentially reduces the inherent dependency tree and bundle size of the package itself.

  In general, code is written in a hybrid style. Imperative/OOP programming makes up the foundational layer of most libraries. On top of this, general FP patterns are applied where applicable. In order to optimize performance, the core library components are often mutable and OOP-based, but immutability, pure functions, and in some cases composition are often sought after as properties that apply to other parts of the libraries and are used when possible.

  However, libraries always strive to expose a declarative API surfaces, with strong focus on flexibility, extensibility, and instantiation/creation with sensible defaults. Furthermore, some optionally support immutable usage as well.

* **Testing**
  
  Testing is primarily done with Jest, with simple unit testing being prioritized in most cases. All tests are put in the `/test` directory in each package.

---

## Web Client
Lib comes supplied with a basic web client. When run, a server is set up with a process that monitors changes to the files, then builds and serves the libraries to the client. The pages for the individual packages can be found at `host/package-name`.

Each library has a `/connect` directory. In it, the system looks for a `feed.js` file, which is used as the entrypoint for the public bundle. In it, a `feed` reference is provided. When called as a function, the library contents are exposed. Under the hood, this is collated into one output object. This output object, and its individual contents, are made globally available on the package page. Furthermore, it is possible to add individual references to the output using `feed.add`. Provided with a name and a resolver callback, any data can be added to the output. In addition to this, example usage can be provided using `feed.example`. Provided with an example name and a configuration object, usage samples can be run in the console. To view a sample usage of both these features, check out `@qtxr/i18n/connect/feed.js`.

---

## CLI
Lib provides a basic command-line tool. This is made available as `ql` and `qlib`. Here are a few use cases for this tool:

* **Package Init**
  
  Using `ql init`, a new package can be initialized. Provide a package name, and optionally the `--verbose` flag for fine-grained initialization, and a form will be presented to complete setup.

* **Git Pushing**
  
  Using `ql git push` or its alias `ql p`, the contents of the current package will be pushed to the remote server. Along with this, the commit will be provided additional information for identification purposes.

* **WEBP**
  
  Using `ql webp`, image contents of a directory can be cloned into a new directory with WEBP assets.

---

## Style Choices
The following are style choices that diverge to some extent, however small, from common style guides (in this case, Airbnb).

* [3.2](https://github.com/airbnb/javascript#es6-computed-properties) - Use computed property names when creating objects with dynamic property names
  
  In general, this is followed, but in certain cases it may be cleaner to assign on the existing object.

* [3.5](https://github.com/airbnb/javascript#objects--grouped-shorthand) - Group your shorthand properties at the beginning of your object declaration
  
  As a general rule, the most pertinent data to the object receives priority over other data. Similarly, grouping of properties with similar properties is also preferred over shorthand definitions.

* [3.8](https://github.com/airbnb/javascript#objects--rest-spread) - Prefer the object spread operator over `Object.assign` to shallow-copy objects. Use the object rest operator to get a new object with certain properties omitted
  
  Object.assign or `@qtxr/utils/inject` are favored over spread, as it is slighty more explicit in most cases. However, mutating the original data is almost always heavily discouraged and is never done except for explicit extensions.

* [4.3](https://github.com/airbnb/javascript#es6-array-spreads) - Use array spreads `...` to copy arrays
  
  `Array.prototype.slice` or `Array.prototype.concat` are preferred over spread in most cases. However, when creating new compound arrays, spread may still be used

* [4.4](https://github.com/airbnb/javascript#arrays--from-iterable) / [4.5](https://github.com/airbnb/javascript#arrays--from-array-like) / [4.6](https://github.com/airbnb/javascript#arrays--mapping) - `Array.from` and spread
  
  These operations are rarely done, as usually data is purposefully stored in a non-array format. Transforms such as these are actively discouraged for iteration. Use an explicit loop, a built-in prototype method, or `@qtxr/utils/forEach` as not to create unnecessary intermediate arrays.

* [6.1](https://github.com/airbnb/javascript#strings--quotes) - Use single quotes `''` for strings
  
  Double quotes are preferred. While this is definitely a stylistic choice, a double quote is harder to confuse for a backtick character. Single quotes are used, however, in console logs, as they look slightly cleaner at a casual glance.

* [7.1](https://github.com/airbnb/javascript#functions--declarations) - Use named function expressions instead of function declarations
  
  Top-level functions are almost exclusively written in function declaration form. Residing in one file, functions should have high cohesion. As such, oftentimes the functions reference and leverage each other to produce an effect. Therefore, functions are seen as intrinsically interconnected and not strictly as procedural steps. In general, the main functions, or entrypoints, are placed at the top, with the supporting functions at the bottom, interwoven if there are multiple entrypoint functions. However, callback functions and closures should always be expressions, and preferably constructed using fat arrow notation.

* [7.7](https://github.com/airbnb/javascript#es6-default-parameters) - Use default parameter syntax rather than mutating function arguments
  
  When feasible and sensible from a method signature point of view, always define defaults inline in the parameters. If further processing needs to be done, it is okay to modify the argument, but only when certain conditions are met:

  1. It is okay to modify an argument if it does not conform to the desired type, when throwing an error is not desired.
  2. It is okay to modify an argument to apply processing to it. When this is done, keeping track of types is a priority.
  3. Argument modifications must happen at the start of a function or method. Once in the main function body, it must be regarded as constant. The exception is when a method is created with the explicit purpose of modifying a passed object (see: [7.12](https://github.com/airbnb/javascript#functions--mutate-params)).
  
  At no point do processing in default parameters (as per [7.8](https://github.com/airbnb/javascript#functions--default-side-effects)).

* [7.10](https://github.com/airbnb/javascript#functions--constructor) - Never use the Function constructor to create a new function
  
  Creating functions is allowed, but great care must be taken to ensure injection cannot occur. Function construction is used by some libraries (chiefly in `@qtxr/utils/mkCharacterSet`, `@qtxr/utils/matchType` and `@qtxr/utils/matrix/#codegenMul`) to optimize performance in simple but dynamic situations. All of them impose strict restrictions on what can be input and will fail if data is not provided in the correct form. The onus of assuring data is safe to use lies on these implementations.

* [8.4](https://github.com/airbnb/javascript#arrows--one-arg-parens) - Always include parentheses around arguments for clarity and consistency
  
  For purely aesthetic reasons, single parameter functions are not wrapped in parentheses. Similarly, 0-parameter functions use `_` as in lieu of `()` for terseness reasons. The underscore also often signifies that the caller does not intend to provide any arguments to the callee.

* [10.3](https://github.com/airbnb/javascript#modules--no-export-from-import) - Do not export directly from an import
  
  These exports are found overwhelmingly in aggregation modules. As such, their intent is clear enough to warrant the shorthand form.

* [10.10](https://github.com/airbnb/javascript#modules--import-extensions) - Do not include JavaScript filename extensions
  
  This rule strictly applies to `.js`, `.mjs`, and `.cjs` modules only. All other files should be given an extension for the sake of clarity (see: `.vue`)

* [13.2](https://github.com/airbnb/javascript#variables--one-const) - Use one `const` or `let` declaration per variable or assignment
  
  Combined with a linter, combining multiple declarations into one statement looks a bit cleaner and more organized, and modern debuggers can step through each sub-statement individually. Only exception is when using `await` syntax in assign.

* [13.6](https://github.com/airbnb/javascript#variables--unary-increment-decrement) - Avoid using unary increments and decrements
  
  Using these specific operators conveys the intent to change a number by a constant amount. You can pry unary operators from my cold, dead, hands.

* [15.1](https://github.com/airbnb/javascript#comparison--eqeqeq) - Use `===` and `!==` over `==` and `!=`
  
  Code should always be robust enough not to accept values of the wrong type. A bug occuring in a loose comparison is likely indicative of a bigger problem wherein incompatible data is allowed to flow through the system.

* [16.1](https://github.com/airbnb/javascript#blocks--braces) - Use braces with all multiline blocks
  
  Single line blocks are always written on two lines, with the body on the second, indented line. This is because adding braces adds unnecessary bloat, and writing a block in a single line makes it more difficult to spot that a special code space is reached. Bugs arising from incorrect use of this syntax is considered rare. However, whenever more than one line is used in a block, brackets are used, even if not strictly necessary (e.g. `for { if / expr }` over `for / if / expr`).

* [17.1](https://github.com/airbnb/javascript#control-statements) - In case your control statement (`if`, `while` etc.) gets too long or exceeds the maximum line length, each (grouped) condition could be put into a new line. The logical operator should begin the line
  
  Only difference here is that operators are put last on preceding lines, as the terms of the statement are likely the main focus of the operation. This rule stems primarily from its use in split-line ternary expressions.

* [19.1](https://github.com/airbnb/javascript#whitespace--spaces) - Use soft tabs (space character) set to 2 spaces
  
  Mostly irrelevant in the grand scheme of things, but tabs offer greater flexibility than spaces in most cases, and may provide benefits to accessibility. Spaces are not used for alignment for similar reasons. 4-space tabs are used to easily make it clear when indentation is getting excessive and refactoring is needed.

* [19.8](https://github.com/airbnb/javascript#whitespace--padded-blocks) - Do not pad your blocks with blank lines
  
  Vertical spacing is used within block bodies to display grouping and separation of concerns.

* [20.2](https://github.com/airbnb/javascript#commas--dangling) - Additional trailing comma
  
  Unnecessary code is unnecessary. For the purposes of this repository, diffs are not a major concern, and leaving a dangling comma can look sloppy.

* [23.4](https://github.com/airbnb/javascript#naming--leading-underscore) - Do not use trailing or leading underscores
  
  Members intended to be left alone (in effect private), are denoted with a single leading underscore. In certain applications, such as `@qtxr/url`, `WeakMap`s are used where available to provide de facto private members.

* [23.6](https://github.com/airbnb/javascript#naming--filename-matches-export) - A base filename should exactly match the name of its default export
  
  Files are always named in `kebab-case`. Classes are converted from `PascalCase` to `kebab-case` letter by letter.

* [24.2](https://github.com/airbnb/javascript#accessors--no-getters-setters24.2) - Do not use JavaScript getters/setters as they cause unexpected side effects and are harder to test, maintain, and reason about
  
  Getters/setters are used sparsely, and purposefully. They should be used primarily for operations that run in constant time, and have minimal side effects, if any. Internally facing API code should avoid using them as much as possible.

* [29.1](https://github.com/airbnb/javascript#standard-library--isnan) / [29.2](https://github.com/airbnb/javascript#standard-library--isfinite) - The Standard Library contains utilities that are functionally broken but remain for legacy reasons
  
  To avoid issues with backwards compatibility, it is often easier to add a `typeof` check along with use of `isNaN` / `isFinite` instead of supplying a polyfill or creating a small utility function.
