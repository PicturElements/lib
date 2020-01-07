<template lang="pug">
	.listing
		.listing-content.error.f.c(v-if="cell.state.error")
			slot(name="error" v-bind="this")
				span {{ cell.state.errorMsg || "failed to load data" }}
		.listing-content.no-results.f.c(v-else-if="cell.state.fetches && (!cellData || !cellData.length)")
			slot(name="no-results" v-bind="this")
				span No items to show
		template(v-else)
			.listing-content.table(
				v-if="conf.viewMode == 'table'"
				:class="{ compact: conf.compact }")
				template(v-if="conf.compact && $scopedSlots['compact-item']")
					.compact-table-sort-form.f.nshrink
						VForm.f-grow(
							:form="compactTableForm"
							:rows="compactTableRows")
							template(#dropdown-option="column") {{ res(column.title) }}
						button.compact-sort-order.ml10(
							:class="`sort-${sortState.order}`"
							@click="compactSetSort")
					.compact-table
						template(v-for="(item, idx) in getItems()")
							slot(name="compact-item" v-bind="mkItem(item, idx)")
				table(v-else)
					tr(v-if="columns")
						template(v-for="(column, idx) in columns")
							th(v-if="column == null")
							th(
								v-else-if="typeof column == 'number'"
								:colspan="column")
							th(v-else-if="typeof column == 'string'") {{ column }}
							th(v-else-if="typeof column == 'function'") {{ res(column) }}
							th.sortable(
								v-else-if="column.sort || column.index"
								:class="sortState.columnIdx == idx ? `sort-${sortState.order}` : null"
								@click="setSort(column, idx)")
								| {{ res(column.title) }}
							th(v-else) {{ res(column.title) }}
					template(v-for="(item, idx) in getItems()")
						slot(name="item" v-bind="mkItem(item, idx)")
			.listing-content.grid(v-else-if="conf.viewMode == 'grid'")
				template(v-for="(item, idx) in cellData")
					slot(name="item" v-bind="mkItem(item, idx)")
			.listing-content.list(v-else)
				template(v-for="(item, idx) in cellData")
					slot(name="item" v-bind="mkItem(item, idx)")
</template>

<script>
	import {
		sym,
		get,
		mergesort
	} from "@qtxr/utils";
	import DataCell, { DataCellPagination } from "@qtxr/data-cell";
	import Form from "@qtxr/form";

	import VForm from "@qtxr/vue-form";

	const colIndexSym = sym("column index"),
		indexerCache = {};

	export default {
		name: "Listing",
		data() {
			const compactTableForm = new Form();

			compactTableForm.hook("change:sortColumn", (form, inp, from, to) => {
				this.setSort(to, to[colIndexSym]);
			});

			return {
				outputData: [],
				compactTableForm,
				compactTableRows: [
					Form.mod("dropdown", {
						name: "sortColumn",
						options: _ => {
							const options = [];

							if (!this.columns)
								return options;

							for (let i = 0, l = this.columns.length; i < l; i++) {
								const column = this.columns[i];

								if (column && (column.sort || column.index)) {
									column[colIndexSym] = i;
									options.push(column);
								}
							}

							return options;
						},
						autoSet: true
					})
				],
				sortState: {
					column: null,
					columnIdx: -1,
					orderPtr: 0,
					order: "ascending"
				},
				cachedItems: null,
				conf: Object.assign({
					viewMode: "list"
				}, this.config)
			};
		},
		methods: {
			mkItem(item, index) {
				return {
					index,
					key: this.cell.getKey(item),
					item: this.cell.getData(item),
					viewMode: this.conf.viewMode
				};
			},
			setSort(column, idx) {
				this.invalidateCache();

				const sortState = this.sortState,
					sortOrders = column.sortOrders || this.sortOrders;

				if (idx == sortState.columnIdx)
					sortState.orderPtr = (sortState.orderPtr + 1) % sortOrders.length; 
				else {
					sortState.column = column;
					sortState.columnIdx = idx;
					sortState.orderPtr = 0;
				}

				sortState.order = sortOrders[sortState.orderPtr];
				this.cell.setState({
					sortOrder: sortState.order,
					sortKey: sortState.column && sortState.column.key
				});
			},
			compactSetSort() {
				const sortVal = this.compactTableForm.inputs.sortColumn.value;
				this.setSort(sortVal, sortVal[colIndexSym]);
			},
			getItems() {
				const sortState = this.sortState,
					items = this.cellData;

				if (this.cachedItems)
					return this.cachedItems;

				if (!Array.isArray(items) || !sortState.column || (!sortState.column.sort && !sortState.column.index) || sortState.order == "neutral")
					return items;

				const sort = sortState.column.sort,
					index = sortState.column.index,
					comparator = typeof sort == "string" ?
						(item, item2) => {
							const val = get(item, sort),
								val2 = get(item2, sort);

							if (val == val2)
								return 0;

							return val > val2 ? 1 : -1;
						} :
						(item, item2) => {
							if (typeof sort == "function") {
								const sortResult = sort(item, item2, this);

								if (typeof sortResult == "number")
									return sortResult;

								return sortResult ? 1 : -1;
							}

							if (item == item2)
								return 0;
							
							return item > item2 ? 1 : -1
						};

				this.cachedItems = mergesort(items, (a, b) => {
					let data = this.doIndex(index, this.cell.getData(a)),
						data2 = this.doIndex(index, this.cell.getData(b));

					return sortState.order == "ascending" ?
						comparator(data, data2) :
						comparator(data, data2) * -1;
				});

				return this.cachedItems;
			},
			doIndex(indexer, data) {
				switch (typeof indexer) {
					case "function":
						return indexer(data, this);

					case "string":
						let xr,
							accessor;

						if (indexerCache.hasOwnProperty(indexer))
							[ xr, accessor ] = indexerCache[indexer];
						else {
							const split = indexer.trim().split(/\s*:\s*/);
							indexerCache[indexer] = split;
							[ xr, accessor ] = split;
						}
						
						switch (xr) {
							case "lexical":
								return String(get(data, accessor)).toLowerCase();
						}
						break;
				}

				return data;
			},
			invalidateCache() {
				this.cachedItems = null;
			},
			res(val) {
				if (typeof val == "function")
					return val.call(this, this.cell);

				return val;
			}
		},
		computed: {
			cellData() {
				return get(this.cell.data, this.conf.accessor || "");
			}
		},
		props: {
			cell: DataCell,
			columns: Array,
			config: Object,
			sortOrders: {
				type: Array,
				default: _ => ["ascending", "descending"]
			}
		},
		watch: {
			"sortState.column"(to) {
				this.compactTableForm.setValues({
					sortColumn: to
				});
			}
		},
		mounted() {
			this.cell.hook("fetched", _ => this.invalidateCache());

			if (!this.columns)
				return;

			for (let i = 0, l = this.columns.length; i < l; i++) {
				const column = this.columns[i];

				if (!column || typeof column != "object" || !column.sort)
					continue;

				if (column.initial) {
					this.setSort(column, i, sortState);
					this.compactTableForm.setValues({
						sortColumn: column
					});
					break;
				}
			}

			const sortState = this.sortState;

			this.cell.setState({
				sortState,
				sortOrder: sortState.order,
				sortKey: sortState.column && sortState.column.key
			});
		}
	}
</script>
