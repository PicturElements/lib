<template lang="pug">
	.listing
		.listing-content.error.f.c(v-if="cell.state.error")
			slot(name="error" v-bind="this")
				span failed to load data
		.listing-content.no-results.f.c(v-else-if="cell.state.fetches && (!cell.data || !cell.data.length)")
			slot(name="no-results" v-bind="this")
				span No items to show
		template(v-else)
			.listing-content.table(v-if="conf.viewMode == 'table'")
				table
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
				template(v-for="(item, idx) in cell.data")
					slot(name="item" v-bind="mkItem(item, idx)")
			.listing-content.list(v-else)
				template(v-for="(item, idx) in cell.data")
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
	import UtilBox from "./util-box.vue";
	import LoadingBox from "./loading-box.vue";

	const hookSym = sym("Listing hook");

	export default {
		name: "Listing",
		data() {
			return {
				outputData: [],
				sortState: {
					column: null,
					columnIdx: -1,
					orderPtr: 0,
					order: "ascending"
				},
				conf: Object.assign({
					viewMode: "list"
				}, this.config)
			};
		},
		methods: {
			mkItem(item, index) {
				const isPagination = this.cell instanceof DataCellPagination;

				item = {
					item: isPagination ? item.data : item,
					viewMode: this.conf.viewMode,
					index
				};

				return item;
			},
			setSort(column, idx) {
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
			getItems() {
				const sortState = this.sortState,
					isPagination = this.cell instanceof DataCellPagination,
					items = this.cell.data;

				if (!items || !sortState.column || (!sortState.column.sort && !sortState.column.index) || sortState.order == "neutral")
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

				return mergesort(items, (a, b) => {
					let data = isPagination ? a.data : a,
						data2 = isPagination ? b.data : b;

					if (typeof index == "function") {
						data = index(data, this);
						data2 = index(data2, this);
					}

					return sortState.order == "ascending" ?
						comparator(data, data2) :
						comparator(data, data2) * -1;
				});
			},
			res(val) {
				if (typeof val == "function")
					return val.call(this, this.cell);

				return val;
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
		beforeMount() {
			if (this.columns) {
				for (let i = 0, l = this.columns.length; i < l; i++) {
					const column = this.columns[i];

					if (!column || typeof column != "object" || !column.sort)
						continue;

					if (column.initial) {
						this.setSort(column, i, sortState);
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
	}
</script>
