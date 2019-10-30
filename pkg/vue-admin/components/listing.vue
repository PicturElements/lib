<template lang="pug">
	UtilBox.listing(
		:config="config"
		:cell="cell")
		.listing-box.error(v-if="cell.state.error")
			slot(name="error")
				span failed to load data
		.listing-box.no-results.f.c(v-else-if="cell.state.fetches && (!cell.data || !cell.data.length)")
			slot(name="no-results")
				span No items to show
		template(v-else)
			.listing-box.table(v-if="config.viewMode == 'table'")
				table
					template(v-for="(item, idx) in cell.data")
						slot(name="item" :self="item.data" :item="mkItem(item.data, idx)")
			.listing-box.grid(v-else-if="config.viewMode == 'grid'")
				template(v-for="(item, idx) in cell.data")
					slot(name="item" :self="item.data" :item="mkItem(item.data, idx)")
			.listing-box.list(v-else)
				template(v-for="(item, idx) in cell.data")
					slot(name="item" :self="item.data" :item="mkItem(item.data, idx)")

		//- Slots / templates
		template(
			v-slot:title-post
			v-if="cell.state.fetches")
			span.listing-count(v-if="isPagination")
				span.listing-count-num.listing-from {{ cell.state.offset }}
				|  - 
				span.listing-count-num.listing-to {{ Math.min(cell.state.offset + cell.state.pageSize, cell.state.total) }}
				span(v-if="cell.state.total < Infinity")
					|  of 
					span.listing-count-num.listing-total {{ cell.state.total }}
			span.count(v-else) {{ cell.data.length || 0 }}
		template(v-slot:header-utils-pre="utilBox")
			slot(
				name="header-utils-pre"
				v-bind="utilBox")
				slot(
					name="header-utils-pre-form"
					v-if="form && rows && rows.headerUtilsPre"
					v-bind="{ form, rows: rows.headerUtilsPre }")
					VForm(
						v-if="form && rows && rows.headerUtilsPre"
						:form="form"
						:rows="rows.headerUtilsPre")
		template(v-slot:loading-box="utilBox")
			slot(name="loading-box" v-bind="utilBox")
		template(v-slot:loading-icon="utilBox")
			slot(name="loading-icon" v-bind="utilBox")
		template(v-slot:title="utilBox")
			slot(name="title" v-bind="utilBox")
		template(v-slot:footer="utilBox")
			.util-box-footer-left.f.ac
			.util-box-footer-right.f.ac
				slot(
					name="footer-right-form"
					v-if="form && rows && rows.footerRight"
					v-bind="{ form, rows: rows.footerRight }")
					VForm(
						:form="form"
						:rows="rows.footerRight")
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
		data() {
			const searchForm = this.form || new Form();

			searchForm.hookNS(hookSym, "change:pageSize", (form, inp, oldVal, newVal) => {
				this.cell.setPageSize(newVal);
			});

			return {
				searchForm
			}
		},
		methods: {
			/*layout() {
				this.runQuery();
				this.sort();
				this.$data.count = this.$data.outList.length;
			},
			runQuery() {
				const filterer = this.$props.filter,
					query = this.$data.query,
					list = this.$props.list,
					tags = this.$props.tags,
					pagination = this.$props.pagination;

				if (pagination) {
					const offset = pagination.offset,
						size = pagination.pageSize,
						outList = [];

					for (let i = 0; i < size; i++) {
						if (!list.hasOwnProperty(offset + i))
							continue;

						const item = list[offset + i];
						if (typeof filterer != "function" || !filterer(query, item, tags, offset + i, list))
							outList.push(item);
					}

					this.$data.outList = outList;
				} else if (typeof filterer == "function")
					this.$data.outList = list.filter((item, i) => !filterer(query, item, tags, i, list));
				else
					this.$data.outList = list;
			},*/
			mkItem(item, idx) {
				item = {
					self: item,
					viewMode: this.config.viewMode,
					idx,
					// TODO: deprecate
					common: this.config.common
				};

				/*item.dispatchChange = change => {
					if (typeof change == "string")
						change = { type: change };

					change.item = item;
					this.bubbleChange(change);
				};*/

				return item;
			},
			/*handleChange(change) {
				switch (change.type) {
					case "count-box:update":
						this.bubbleChange({
							type: "listing:newPage",
							id: this.$props.identifier || null,
							offset: (change.count - 1) * this.$props.pagination.pageSize
						});
						return false; // Don't propagate count box change further
				}
			}*/
		},
		computed: {
			isPagination() {
				return this.cell instanceof DataCellPagination;
			}
		},
		props: {
			cell: DataCell,
			form: Form,
			rows: Object,
			config: {
				type: Object,
				default: _ => ({
					viewMode: "list",
					reload: true
				})
			}
		},
		components: {
			VForm,
			UtilBox,
			LoadingBox
		},
		beforeDestroy() {
			this.searchForm.unhookNS(hookSym);
		}
	}
</script>
