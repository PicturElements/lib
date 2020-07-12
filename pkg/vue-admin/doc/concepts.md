# VueAdmin Concepts

VueAdmin is in effect a framework built on top of Vue. What VueAdmin aims to do is to add functionality to the base framework to make the code written for it terse, expressive, maintainable, and easier to write.

### Views

Views are top level components that are intrinsically bound to routes. A view has a corresponding model that abstracts functionality away from the view. Views connect to the admin system using `VueAdmin.wrap`. `VueAdmin.wrap` connects

### Models

Models are data linked to views. They primarily provide data for views define how data is used. They may also define functionality that the view may find use in. A core data type used in models is the `DataCell`. Data cells are wrappers for data that define how and when data is fetched, how it's processed, and how it may change. Data cells are fundamentally asynchronous and are mainly used to simplify data flows. `DataCell` extends `@qtxr/bc/Hookable` to make connecting to data changes explicit and clear.

### Components

### Routing

### Templates

### Hooks

### Interfaces

### Plugins

### Modules
