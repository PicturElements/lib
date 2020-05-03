<template lang="pug">
	.v-form
		.input-row(
			v-for="(row, idx) in processedRows"
			:class="`input-row-${idx}`")
			template(v-for="cell in row")
				.input-box(
					v-if="cell.input.visible"
					:class="jc(cell.class.box, `input-box-${cell.input.type || 'text'}`)"
					:data-name="cell.input.name")
					p.title(
						v-if="cell.title"
						:class="jc({ required: cell.input.required }, cell.class.title)")
							| {{ res(cell, cell.title) }}
					slot(:name="`${cell.input.name}-pre-content`" v-bind="bind(cell)")
						slot(name="pre-content" v-bind="bind(cell)")
					InputWrapper(
						:class="cell.class.input"
						:cell="cell"
						:meta="inputMeta"
						:verifiedVisibility="true"
						:disabled="cell.input.disabled"
						:readonly="cell.input.readonly"
						:key="cell.input.id")
						template(
							v-for="(_, name) in $scopedSlots"
							#[name]="d")
							slot(v-if="name != 'form'"
								:name="name"
								v-bind="d")
						template(#form="d")
							VForm(
								:form="d.form"
								:rows="d.rows")
					slot(:name="`${cell.input.name}-post-content`" v-bind="bind(cell)")
						slot(name="post-content" v-bind="bind(cell)")
</template>

<script>
	import { joinClass } from "@qtxr/utils";
	import Form, { FormRows } from "@qtxr/form";

	import InputWrapper from "./input-wrapper.vue";

	export default {
		name: "VForm",
		data() {
			const rows = this.rows,
				settings = this.settings || rows || {},
				form = this.form || new Form(settings.preset || settings.hooks, settings.opt);

			if (rows) {
				return {
					processedRows: rows.isFormRows ?
						rows :
						form.connectRows(rows)
				};
			}

			form.hook("connected", (f, struct) => {
				this.processedRows = struct;
			}, 1);

			return {
				processedRows: []
			};
		},
		methods: {
			jc: joinClass,
			mkRuntime(cell) {
				return {
					self: this,
					input: cell.input,
					form: cell.input.form,
					rootForm: cell.input.form,
					inputs: cell.input.form.inputs,
					rootInputs: cell.input.form.inputs,
					inputsStruct: cell.input.form.inputsStruct,
					rootInputsStruct: cell.input.form.inputsStruct,
					value: cell.input.value
				};
			},
			res(cell, val, ...args) {
				if (typeof val == "function")
					return val.call(this, this.mkRuntime(cell), ...args);

				return val;
			},
			bind(cell) {
				return this.mkRuntime(cell);
			}
		},
		computed: {
			inputMeta() {
				return {
					mobileQuery: this.mobileQuery
				}
			}
		},
		components: {
			InputWrapper
		},
		props: {
			form: Form, 
			rows: [Array, Object],
			settings: Object,
			mobileQuery: {
				type: String,
				default: "(max-aspect-ratio: 1/1) and (max-width: 700px)"
			}
		}
	};
</script>
