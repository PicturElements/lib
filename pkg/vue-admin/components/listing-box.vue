<template lang="pug">
	UtilBox.listing-box(
		:config="config"
		:cell="cell")
		
		Listing(
			:config="config"
			:cell="cell")
			template(v-slot:error="listing")
				slot(name="error" v-bind="listing")
			template(v-slot:no-results="listing")
				slot(name="no-results" v-bind="listing")
			template(v-slot:item="d")
				slot(name="item" v-bind="d")

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
			span.listing-count(v-else-if="isArray(cell.data)") {{ cell.data.length }}
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
		template(
			v-if="isPagination"
			v-slot:footer="utilBox")
			.util-box-footer-left.f.ac
				.page-selector.f
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
	import Listing from "./listing.vue";
	import UtilBox from "./util-box.vue";
	import LoadingBox from "./loading-box.vue";

	const hookSym = sym("Listing hook");

	export default {
		name: "ListingBox",
		data() {
			const searchForm = this.form || new Form();

			return {
				searchForm
			}
		},
		methods: {
			isArray: Array.isArray
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
			Listing,
			UtilBox,
			LoadingBox
		},
		beforeDestroy() {
			this.searchForm.unhookNS(hookSym);
		}
	}
</script>
