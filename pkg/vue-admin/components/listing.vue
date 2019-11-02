<template lang="pug">
	.listing
		.listing-content.error(v-if="cell.state.error")
			slot(name="error" v-bind="this")
				span failed to load data
		.listing-content.no-results.f.c(v-else-if="cell.state.fetches && (!cell.data || !cell.data.length)")
			slot(name="no-results" v-bind="this")
				span No items to show
		template(v-else)
			.listing-content.table(v-if="config.viewMode == 'table'")
				table
					template(v-for="(item, idx) in cell.data")
						slot(name="item" v-bind="mkItem(item, idx)")
			.listing-content.grid(v-else-if="config.viewMode == 'grid'")
				template(v-for="(item, idx) in cell.data")
					slot(name="item" v-bind="mkItem(item, idx)")
			.listing-content.list(v-else)
				template(v-for="(item, idx) in cell.data")
					slot(name="item" v-bind="mkItem(item, idx)")
</template>

<script>
	import { sym } from "@qtxr/utils";
	import DataCell, { DataCellPagination } from "@qtxr/data-cell";
	import Form from "@qtxr/form";

	import VForm from "@qtxr/vue-form";
	import UtilBox from "./util-box.vue";
	import LoadingBox from "./loading-box.vue";

	const hookSym = sym("Listing hook");

	export default {
		name: "Listing",
		methods: {
			mkItem(item, index) {
				item = {
					self: item,
					viewMode: this.config.viewMode,
					index
				};

				return item;
			}
		},
		props: {
			cell: DataCell,
			config: {
				type: Object,
				default: _ => ({
					viewMode: "list"
				})
			}
		}
	}
</script>
