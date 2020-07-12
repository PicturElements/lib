# DataCellPagination

`DataCellPagination` extends `DataCell` and introduces pagination, that is, a unified way to load tabular data in chunks for presentation. To optimize pagination, `DataCellPagination` employs a number of processors

### Sequencers

`config.sequence: function(cell, data item) | accessor: string | [ accessor: string, processor: function ]`

Sequencers are a powerful way to manage te insertion and modification of pagination data. To enable this, however, the sequencer must provide data on a fixed form. A sequencer processor is applied over new pagination data and returns an integer, called a sequence number. These integers are thus linked to the inherent order of the data provided and clue the system into when data should be loaded anew. In this case, inherent order means that there's a permanent one-to-one correspondence between the data and its sequence number, and the system assumes this to always be true. Failure to honor this may cause corruption of data. Sequence numbers should be strictly increasing, meaning that newer data gets a higher sequence number than older data. This also means that when a higher sequence number is found than the current highest sequence number, the new data will be shifted in at the start of the pagination array.

### Taggers

`config.tag: function(cell, data item) | accessor: string | [ accessor: string, processor: function ]`

Taggers are similar to sequencers, but their only task is to tag data for later use.

### Fetching

As `DataCellPagination` is a specialized class, it imposes a strict set of rules of what can be fetched. Fetched data may be one of the following:

1. Array of data
	The most basic form of data that can be inputted into the system is an array. Providing this data only updates the pagination.

2. Metadata object
	If there's more data that is needed from the fetched endpoint, it can be bundled with the main payload. A metadata object looks like this:

		{
			data	// Array of data (required)
			total	// Total length of the current set of data (optional)
		}

	When processed, the main payload and metadata are dealt with separately.
