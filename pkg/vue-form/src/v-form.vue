<template lang="pug">
	.v-form
		.input-row(
			v-for="(row, idx) in processedRows"
			:class="`input-row-${idx}`")
			template(v-for="cell in row")
				.input-box(
					v-if="cell.input.visible"
					:class="joinClass(cell.class.box, `input-box-${cell.input.type || 'text'}`)"
					:data-name="cell.input.name")
					p.title(
						v-if="cell.title"
						:class="joinClass({ required: cell.input.required }, cell.class.title)")
							| {{ res(cell.title) }}
					slot(:name="`${cell.input.name}-pre-content`" v-bind="cell.input")
						slot(name="pre-content" v-bind="cell.input")
					InputWrapper(
						:class="cell.class.input"
						:cell="cell"
						:meta="inputMeta"
						:verifiedVisibility="true"
						:disabled="cell.input.disabled"
						:key="cell.input.id")
						template(
							v-for="(_, name) in $scopedSlots"
							v-slot:[name]="d")
							slot(v-if="name != 'form'"
								:name="name"
								v-bind="d")
						template(#form="d")
							VForm(
								:form="d.form"
								:rows="d.rows")
					slot(:name="`${cell.input.name}-post-content`" v-bind="cell.input")
						slot(name="post-content" v-bind="cell.input")
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

			if (rows && rows.isFormRows) {
				return {
					processedRows: rows
				};
			}

			return {
				processedRows: rows ? form.connectRows(rows) : (form.rows || [])
			};
		},
		methods: {
			joinClass,
			res(val, ...args) {
				if (typeof val == "function")
					return val.call(this, this.form, ...args);

				return val;
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
