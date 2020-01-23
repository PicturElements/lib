<template lang="pug">
	.util-box(:class="{ minimal: conf.minimal }")
		.util-box-header.f.jsb.ac(v-if="!conf.minimal")
			.util-box-header-left.f.ac
				.util-box-title-box.f.ac
					slot(
						name="title-pre"
						v-bind="generalData")
					.util-box-title
						slot(
							name="title"
							v-bind="generalData")
					slot(
						name="title-post"
						v-bind="generalData")
			.util-box-header-right.f.ac
				.util-box-header-utils.f.ac
					slot(
						name="header-utils-pre"
						v-bind="headerUtilsData")
						slot(
							name="header-utils-pre-form"
							v-if="headerUtilsData.formular"
							v-bind="headerUtilsData")
					slot(
						name="header-utils"
						v-bind="generalData")
						slot(
							name="header-utils-reload"
							v-bind="generalData")
							button.admin-btn.square.expand-disabled.fade-color.reload(
								v-if="conf.reload && cell"
								:disabled="cell.state.loading"
								@click="cell.fetch()")
								slot(
									name="header-utils-reload-icon"
									v-bind="generalData") ↻
					slot(
						name="header-utils-post"
						v-bind="generalData")
		.util-box-sub-header(v-if="subHeaderData.formular || hasSlot('sub-header', 'sub-header-form')")
			slot(
				name="sub-header"
				v-bind="subHeaderData")
				slot(
					name="sub-header-form"
					v-if="subHeaderData.formular"
					v-bind="subHeaderData")
					VForm(
						:form="subHeaderData.form"
						:rows="subHeaderData.rows")
		.util-box-content(ref="content")
			.util-box-main-content
				template(v-if="hasSlot('cell-data')")
					slot(
						name="cell-data"
						v-if="cell.state.loaded || cell.state.fetches"
						v-bind="cell.data")
				slot(
					v-else
					v-bind="generalData")
			slot(name="loading-box" v-bind="generalData")
				LoadingBox.semi-transparent(
					v-if="hasSlot('loading-icon')"
					:cell="cell")
					slot(
						name="loading-icon"
						v-bind="generalData")
		.util-box-footer.f.jsb.ac(v-if="footerLeftData.formular || footerRightData.formular || hasSlot('footer', 'footer-left', 'footer-left-form', 'footer-right', 'footer-right-form')")
			slot(
				name="footer"
				v-bind="generalData")
				.util-box-footer-left.f.ac
					slot(
						name="footer-left"
						v-bind="footerLeftData")
						slot(
							name="footer-left-form"
							v-if="footerLeftData.formular"
							v-bind="footerLeftData")
							VForm(
								:form="footerLeftData.form"
								:rows="footerLeftData.rows")
				.util-box-footer-right.f.ac
					slot(
						name="footer-right"
						v-bind="footerRightData")
						slot(
							name="footer-right-form"
							v-if="footerRightData.formular"
							v-bind="footerRightData")
							VForm(
								:form="footerRightData.form"
								:rows="footerRightData.rows")
</template>

<script>
	import { get } from "@qtxr/utils";
	import DataCell from "@qtxr/data-cell";
	import Form from "@qtxr/form";

	import VForm from "@qtxr/vue-form";
	import LoadingBox from "./loading-box";

	export default {
		name: "UtilBox",
		data() {
			return {
				conf: Object.assign({
					reload: true
				}, this.config)
			};
		},
		methods: {
			getRows(accessor) {
				const selfRows = get(this.rows, accessor);
				if (selfRows)
					return selfRows;

				if (!this.cell)
					return null;

				const cellRows = this.cell.form && get(this.cell.form.inputsStruct, accessor);
				if (cellRows)
					return cellRows;

				return null;
			},
			hasSlot(...names) {
				for (let i = 0, l = names.length; i < l; i++) {
					if (this.$scopedSlots[names[i]])
						return true;
				}

				return false;
			},
			getSlotData(rowAccessor) {
				const form = this.frm,
					rows = rowAccessor ?
						this.getRows(rowAccessor) :
						form && form.inputsStruct;

				return {
					box: this,
					form,
					rows,
					formular: Boolean(rowAccessor && form && rows)
				};
			}
		},
		computed: {
			frm() {
				if (this.form instanceof Form)
					return this.form;

				if (this.cell && this.cell.form instanceof Form)
					return this.cell.form;

				return null;
			},
			generalData() {
				return this.getSlotData(null);
			},
			headerUtilsData() {
				return this.getSlotData("headerUtilsPre");
			},
			subHeaderData() {
				return this.getSlotData("subHeader");
			},
			footerLeftData() {
				return this.getSlotData("footerLeft");
			},
			footerRightData() {
				return this.getSlotData("footerRight");
			}
		},
		props: {
			config: Object,
			cell: DataCell,
			form: Form,
			formRows: Object
		},
		components: {
			LoadingBox,
			VForm
		}
	};
</script>
