<template lang="pug">
	InputBlock.v-form(
		:blocks="blocks"
		:mobileQuery="mobileQuery"
		:root="true")
		template(
			v-for="(_, name) in $scopedSlots"
			#[name]="d")
			slot(v-if="name != 'form'"
				:name="name"
				v-bind="d")
		template(#form="{ form, rows }")
			VForm(
				:form="form"
				:rows="rows")
</template>

<script>
	import Form from "@qtxr/form";

	import InputBlock from "./core/input-block";
	import utilMixin from "./util-mixin";

	export default {
		name: "VForm",
		mixins: [utilMixin],
		data() {
			let rows = this.rows;
			const settings = this.settings || rows || {},
				form = this.form || new Form(settings.preset || settings.hooks, settings.opt);

			rows = !rows && form.inputsStruct && form.inputsStruct.length ?
				form.inputsStruct :
				rows;

			if (rows) {
				return {
					blocks: rows.isInputBlock ?
						rows :
						form.connectRows(rows)
				};
			}

			form.hook("connected", (f, struct) => {
				this.blocks = struct;
			}, 1);

			return {
				blocks: []
			};
		},
		components: {
			InputBlock
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
