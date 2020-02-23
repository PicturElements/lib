# Pros and Cons
This document aims to highlight the strengths and weaknesses of the data structures found in this library. There exists no universal optimal data structure, so care must be taken to pick the right tool for the job.

## KeyedLinkedList

| Operation | Time | Notes / Worst Cases |
|-|-|-|
| Insert | `O(1)` |  |
| Delete | `O(1)` | Delete removes all entries with the provided key. Worst case is `O(m)`, where `m` is the number of entries with the given key. If `enforceUnique` is true, this operation is still constant. |
| Search | `O(1)` | Finds all entries with the given key. |
| Find | `O(n)` | Returns the node picked out by the provided function. The nodes must be traversed for this operation. |
| Iteration | `O(n)` | If the next node in line is removed from the instance, the iterator will have to find the next entry, which takes linear time. |
