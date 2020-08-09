# Data Structures Overview
This document aims to highlight the strengths and weaknesses of the data structures found in this library. Of course, there exists no universal optimal data structure, so care must be taken to pick the right tool for the job. In this document, we'll explore the pros and cons of each data structure. The implementations found in this package prioritize speed over memory, as in most applications (web especially) data sets are either small enough for neither complexity to matter significantly, or not big enough for memory usage to severely impede performance. They may be big enough, however, for running time to be significant. In the below tables average-time complexity is used, and worst case scenarios are elaborated on where applicable. Furthermore, many of the implementations use amortization which are also documented in the notes.

## KeyedLinkedList

| Operation | Time | Notes / Worst Cases |
|-|-|-|
| Insert | `Θ(1)` | Inserts a value at a given key. The key must be serializable primitive. If  |
| Retrieve | `Θ(1)` | Retrieves all values with the given key. Worst case is `O(m)`, where `m` is the number of entries with the given key. If `enforceUnique` is true, this operation is still constant. If the `item` prototype method is used, the operation is still constant. |
| Delete | `Θ(1)` | Delete removes all entries with the provided key. Worst case is `O(m)`, where `m` is the number of entries with the given key. If `enforceUnique` is true, this operation is still constant. |
| Search | `Θ(1)` | Finds all entries with the given key. |
| Find | `Θ(n)` | Returns the node picked out by the provided function. The nodes must be traversed for this operation. |
| Iteration | `Θ(n)` | If the current node is removed from the instance, the iterator will have to find the next entry in the next iteration step, which is a linear operation, making the worst case performance <code>O(n<sup>2</sup>)</code>. |
