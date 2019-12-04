# DataCellComposite

`DataCellComposite` extends `DataCell` and introduces hierarchical data management. In a composite data cell, data is created and loaded in a special way. The following rules apply:

1. Parent data cells are only marked as fully loaded when every single one of their children has been loaded. For this, all nodes in a composite data cell instance receive an additional state field, `fullyLoaded`, and related runtime state field, `pendingChildrenCount`, which is set according to the above rule. This allows developers to support partial loading without runtime errors.
2. Data cell configuration may contain a special `scope` field (alias: `cells`) which is resolved into a scope of data cells; a tree. Data cell configuration may be nested, even within non-data cell configuration data, and the `DataCellComposite` instance automatically detects what data to convert into data cell instances.
3. When data cell configuration is detected, the `DataCellComposite` instance resolves it into a new DataCell of the correct type. At the same time, this instance is injected into the instance's data. This is done so that data cells may always be defined and accessed without error.

### Passive and Active Cells

Normally, data cells may not be defined without a fetcher method, or must use a use  that defines one. In composite cells, this is no longer true. If a cell lacks a fetcher method it will instead become passive. Passive data cells are bound to their parents for core functionality, which manifests itself in the following ways:

1. When data is requested in a passive cell, the closest active parent is requested to fetch.
2. A passive cell inherits data from its closest active parent, the parent cell's data includes the cell, and upon load the loaded data is passed to the passive cell.

In contrast, active cells are largely decoupled from their parents' data:

1. When data is requested in an active cell, the cell itself is responsible of delivering the data.
2. An active cell doesn't inherit its parents' data, nor does it directly interface with them. Thus, an active cell is best described as an independent node in the composite cell tree. 
