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
				.page-selector.f(v-if="isPagination")
					button.page-selector-btn.f.c(
						v-for="page in pages"
						:class="page.class"
						:disabled="page.disabled"
						@click="cell.setPage(page.id)") {{ page.id + 1 }}
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
			mkItem(item, idx) {
				item = {
					self: item,
					viewMode: this.config.viewMode,
					idx
				};

				return item;
			}
		},
		computed: {
			isPagination() {
				return this.cell instanceof DataCellPagination;
			},
			pages() {
				const cell = this.cell,
					state = cell.state,
					page = state.page,
					pageCount = Math.ceil(state.total / state.pageSize) - 1,
					padding = Math.min(this.config.navPadding, pageCount / 2),
					floorPad = Math.floor(padding),
					ceilPad = Math.ceil(padding),
					fullPadding = padding * 2,
					pages = [];
				let padLeft = page < pageCount / 2 ?
						Math.min(floorPad, page) :
						fullPadding - Math.min(pageCount - page, ceilPad),
					padRight = page < pageCount / 2 ?
						fullPadding - Math.min(floorPad, page) :
						Math.min(pageCount - page, ceilPad);

				if (this.config.pageArrows) {
					pages.push({
						id: 0,
						class: "to-start",
						disabled: page <= 0
					}, {
						id: page - 1,
						class: "decrement",
						disabled: page <= 0
					});
				}

				for (let i = 0; i < padLeft + 1 + padRight; i++) {
					pages.push({
						id: page + i - padLeft,
						class: i == padLeft ? "selected" : null
					});
				}

				if (this.config.pageArrows) {
					pages.push({
						id: page + 1,
						class: "increment",
						disabled: page >= pageCount
					});

					if (isFinite(pageCount)) {
						pages.push({
							id: pageCount,
							class: "to-end",
							disabled: page >= pageCount
						});
					}
				}
				
				return pages;
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
					navPadding: 2,
					pageArrows: true,
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
