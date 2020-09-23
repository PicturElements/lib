// Fluid configs are specialized configuration compilers
// They consume arbitrary configuration data, and then validate
// and normalize it so it can be consumed by other systems
//
// Configuration:
// schema: object
// consumers: object
// identifierField: string
// identifierPartitions: array
//
// schema:
// An object that applies to the provided input. It can be thought of
// as an interface of sorts for configuration data. By default, errors
// are emitted if non-conforming data is found, but this can be configured
// with the strictSchema flag
//
// consumers:
// An object that applies to the provided input. It is an extension of the
// schema object in that it enables more fine-grained control over inputs
// For instance, type checking, type checking sensitivity, input processing,
// and more can be defined within a consumer object
//
// identifierField:
// If this is defined, cross-referencing is enabled. If the field it defines
// is found in the input configuration data, a reference is created to the
// object. This can then be referenced 

// Use path stack to keep track of invalid data
