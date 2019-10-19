# Viz accessors

To provide a rich and flexible API, Viz uses accessors to get resources. Accessors are passed through @qtxr/utils/get, which means that they may be strings or arrays of strings. All accessors are resolved relative to some data, which may differ between resources. In this document, you'll find the resources, accessors, and useful information you may need.

## I18N

| Root data | Example |
--|--
| I18N data store | `viz.time.months` |

Viz uses @qtxr/i18n under the hood. I18N uses accessors natively, and so to integrate Viz to an existing I18N instance, it's recommended that accessors are scoped within a `viz` fragment.