<template lang="pug">
	UtilBox.listing-box(
		:config="conf"
		:cell="cell"
		:form="form"
		:formRows="formRows")

		Listing(
			:config="conf"
			:cell="cell"
			:columns="columns"
			:sortOrders="sortOrders")
			template(#error="listing")
				slot(
					name="error"
					v-bind="listing")
			template(#no-results="listing")
				slot(
					name="no-results"
					v-bind="listing")
			template(#item="d")
				slot(
					name="item"
					v-bind="d")
			template(
				v-if="hasSlot('compact-item')"
				#compact-item="item")
				slot(
					name="compact-item"
					v-bind="item")

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
			span.listing-count(v-else-if="isArray(cell.data) && !conf.hideListingCount") {{ cell.data.length }}
		template(#header-utils-pre="d")
			slot(
				name="header-utils-pre"
				v-bind="d")
				slot(
					name="header-utils-pre-form"
					v-bind="d")
					VForm(
						:form="d.form"
						:rows="d.rows")
		template(#loading-box="d")
			slot(
				name="loading-box"
				v-bind="d")
		template(#loading-icon="d")
			slot(
				name="loading-icon"
				v-bind="d")
		template(#title="d")
			slot(
				name="title"
				v-bind="d")
		template(
			v-if="isFormular('subHeader') || hasSlot('sub-header', 'sub-header-form')"
			#sub-header="d")
			slot(
				name="sub-header"
				v-bind="d")
				slot(
					name="sub-header-form"
					v-bind="d")
					VForm(
						:form="d.form"
						:rows="d.rows")
		template(v-if="hasSlot('footer') && !hasSlot('footer-left', 'footer-left-form', 'footer-right', 'footer-right-form')"
			#footer="d")
			slot(
				name="footer"
				v-bind="d")
		template(
			#footer-left="d"
			v-if="isPagination || isFormular('footerLeft') || hasSlot('footer-left', 'footer-left-form')")
			slot(
				name="footer-left"
				v-bind="d")
				slot(
					v-if="isFormular('footerLeft') || hasSlot('footer-left', 'footer-left-form')"
					name="footer-left-form"
					v-bind="d")
					VForm(
						:form="d.form"
						:rows="d.rows")
				.page-selector.f(v-else-if="isPagination")
					button.page-selector-btn.f.c(
						v-for="page in pages"
						:class="page.class"
						:disabled="page.disabled"
						@click="cell.setPage(page.id)") {{ page.id + 1 }}
		template(
			v-if="isFormular('footerRight') || hasSlot('footer-right', 'footer-right-form')"
			#footer-right="d")
			slot(
				name="footer-right"
				v-bind="d")
				slot(
					name="footer-right-form"
					v-bind="d")
					VForm(
						:form="d.form"
						:rows="d.rows")
</template>

<script>
	import { get } from "@qtxr/utils";
	import DataCell, { DataCellPagination } from "@qtxr/data-cell";
	import Form from "@qtxr/form";

	import VForm from "@qtxr/vue-form";
	import Listing from "./listing.vue";
	import UtilBox from "./util-box.vue";

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
			isFormular(accessor) {
				if (!this.frm)
					return false;

				const selfRows = get(this.rows, accessor);
				if (selfRows)
					return true;

				if (!this.cell)
					return null;

				const cellRows = this.frm && get(this.frm.inputsStruct, accessor);
				if (cellRows)
					return true;

				return false;
			},
			hasSlot(...names) {
				for (let i = 0, l = names.length; i < l; i++) {
					if (this.$scopedSlots[names[i]])
						return true;
				}

				return false;
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

				if (this.cell && this.cell.args.form instanceof Form)
					return this.cell.args.form;

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
			UtilBox
		}
	}
</script>
