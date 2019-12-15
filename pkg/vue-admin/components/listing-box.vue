<template lang="pug">
	UtilBox.listing-box(
		:config="conf"
		:cell="cell")
		
		Listing(
			:config="conf"
			:cell="cell"
			:columns="columns"
			:sortOrders="sortOrders")
			template(#error="listing")
				slot(name="error" v-bind="listing")
			template(#no-results="listing")
				slot(name="no-results" v-bind="listing")
			template(#item="d")
				slot(name="item" v-bind="d")
			template(
				v-if="$scopedSlots['compact-item']"
				#compact-item="item")
				slot(name="compact-item" v-bind="item")

		//- Slots / templates
		template(
			#title-post
			v-if="cell.state.fetches")
			span.listing-count(v-if="isPagination && !conf.hideListingCount")
				span.listing-count-num.listing-from {{ cell.state.offset }}
				|  - 
				span.listing-count-num.listing-to {{ Math.min(cell.state.offset + Math.min(cell.state.pageSize, cell.state.fetchedLength), cell.state.total) }}
				span(v-if="cell.state.total < Infinity")
					|  of 
					span.listing-count-num.listing-total {{ cell.state.total }}
			span.listing-count(v-else-if="isArray(cell.data)") {{ cell.data.length }}
		template(#header-utils-pre="utilBox")
			slot(
				name="header-utils-pre"
				v-bind="utilBox")
				slot(
					name="header-utils-pre-form"
					v-if="frm && getRows('headerUtilsPre')"
					v-bind="{ box: utilBox, form: frm, rows: getRows('headerUtilsPre') }")
					VForm(
						:form="frm"
						:rows="getRows('headerUtilsPre')")
		template(#loading-box="utilBox")
			slot(name="loading-box" v-bind="utilBox")
		template(#loading-icon="utilBox")
			slot(name="loading-icon" v-bind="utilBox")
		template(#title="utilBox")
			slot(name="title" v-bind="utilBox")
		template(
			v-if="$scopedSlots['sub-header'] || $scopedSlots['sub-header-form']"
			#sub-header="utilBox")
			slot(
				name="sub-header"
				v-bind="utilBox")
				slot(
					name="sub-header-form"
					v-if="frm && getRows('subHeader')"
					v-bind="{ box: utilBox, form: frm, rows: getRows('subHeader')}")
					VForm(
						:form="frm"
						:rows="getRows('subHeader')")
		template(
			v-if="isPagination"
			#footer="utilBox")
			.util-box-footer-left.f.ac
				.page-selector.f
					button.page-selector-btn.f.c(
						v-for="page in pages"
						:class="page.class"
						:disabled="page.disabled"
						@click="cell.setPage(page.id)") {{ page.id + 1 }}
			.util-box-footer-right.f.ac
				slot(
					name="footer-right"
					v-bind="utilBox")
					slot(
						name="footer-right-form"
						v-if="frm && getRows('footerRight')"
						v-bind="{ box: utilBox, form: frm, rows: getRows('footerRight') }")
						VForm(
							:form="frm"
							:rows="getRows('footerRight')")
		template(
			v-else-if="$scopedSlots['footer']"
			#footer="utilBox")
			slot(name="footer" v-bind="utilBox")
</template>

<script>
	import {
		sym,
		get
	} from "@qtxr/utils";
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
			return {
				conf: Object.assign({
					viewMode: "list",
					navPadding: 2,
					pageArrows: true,
					reload: true,
					hideListingCount: false
				}, this.config)
			};
		},
		methods: {
			isArray: Array.isArray,
			getRows(accessor) {
				const selfRows = get(this.rows, accessor);
				if (selfRows)
					return selfRows;

				const cellRows = this.cell.form && get(this.cell.form.inputsStruct, accessor);
				if (cellRows)
					return cellRows;

				return null;
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
					padding = Math.min(this.conf.navPadding, pageCount / 2),
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

				if (this.conf.pageArrows) {
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

				if (this.conf.pageArrows) {
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
			},
			frm() {
				if (this.form instanceof Form)
					return this.form;

				if (this.cell.form instanceof Form)
					return this.cell.form;

				return null;
			}
		},
		props: {
			cell: DataCell,
			form: Form,
			formRows: Object,
			columns: Array,
			sortOrders: Array,
			config: Object
		},
		components: {
			VForm,
			Listing,
			UtilBox,
			LoadingBox
		}
	}
</script>
