<template lang="pug">
	.v-form
		.input-row(v-for="row in processedRows")
			.input-box(v-for="cell in row" :class="cell.class.box")
				p.title(
					v-if="cell.title"
					:class="joinCls({ required: cell.input.required }, cell.class.title)")
						| {{ res(cell.title) }}
				slot(:name="`${cell.input.name}-pre-content`" v-bind="cell.input")
					slot(name="pre-content" v-bind="cell.input")
				template(v-if="cell.input.type == 'checkbox'")
					Checkbox(
						:class="cell.class.input"
						:input="cell.input"
						:label="res(cell.label)")
						template(v-slot:icon="inp")
							slot(:name="`${cell.input.name}-icon`" v-bind="inp")
								slot(name="checkbox-icon" v-bind="inp")
				template(v-else-if="cell.input.type == 'count'")
					Count(
						:class="cell.class.input"
						:input="cell.input"
						:symbols="res(cell.symbols)")
						template(v-slot:down-symbol="inp")
							slot(:name="`${cell.input.name}-down-symbol`" v-bind="inp")
								slot(name="count-down-symbol" v-bind="inp")
						template(v-slot:up-symbol="inp")
							slot(:name="`${cell.input.name}-up-symbol`" v-bind="inp")
								slot(name="count-up-symbol" v-bind="inp")
				template(v-else-if="cell.input.type == 'dropdown'")
					Dropdown(
						:class="cell.class.input"
						:input="cell.input"
						:placeholder="res(cell.placeholder)")
						template(v-slot="option")
							slot(:name="`${cell.input.name}-option`" v-bind="option")
								slot(name="dropdown-option" v-bind="option")
						template(v-slot:icon="data")
							slot(:name="`${cell.input.name}-icon`" v-bind="data")
								slot(name="dropdown-icon" v-bind="data")
				template(v-else-if="cell.input.type == 'radio'")
					Radio(
						:class="cell.class.input"
						:input="cell.input")
						template(v-slot:label="option")
							slot(:name="`${cell.input.name}-label`" v-bind="option")
								slot(name="radio-label" v-bind="option")
						template(v-slot:custom-content="option")
							slot(:name="`${cell.input.name}-custom-content`" v-bind="option")
								slot(name="radio-custom-content" v-bind="option")
				template(v-else)
					Input(
						:class="cell.class.input"
						:input="cell.input"
						:placeholder="res(cell.placeholder)")
				slot(:name="`${cell.input.name}-post-content`" v-bind="cell.input")
					slot(name="post-content" v-bind="cell.input")
</template>

<script>
	import Form from "@qtxr/form";

	import Input from "./input";
	import Checkbox from "./checkbox";
	import Count from "./count";
	import Dropdown from "./dropdown";
	import Radio from "./radio";

	export default {
		name: "VForm",
		data() {
			const rows = this.rows,
				settings = Array.isArray(rows) ? {} : rows,
				inputs = Array.isArray(rows) ? rows : settings.inputs || [],
				form = this.form || new Form(settings.preset || settings.hooks, settings.opt);
			
			const connect = (inps, depth) => {
				const out = [];

				if (depth > 1)
					throw new RangeError("Form construction failed: input data nested past one level");

				for (let i = 0, l = inps.length; i < l; i++) {
					const cell = inps[i];

					if (Array.isArray(cell))
						out.push(connect(cell, depth + 1));
					else {
						let cellProcessed = null;

						if (typeof cell == "string") {
							const nameOptions = cell.trim().split(/\s*:\s*/);

							cellProcessed = {
								name: nameOptions[1] || nameOptions[0],
								opt: nameOptions[0]
							};
						} else {
							cellProcessed = Object.assign({}, cell);

							if (cellProcessed.opt)
								Form.mod({}, cellProcessed.opt, cellProcessed);
							else
								cellProcessed.opt = cellProcessed;
						}

						if (cellProcessed.classes)
							cellProcessed.class = cellProcessed.classes;
						else {
							cellProcessed.class = typeof cellProcessed.class == "string" ? {
								input: cellProcessed.class
							} : cellProcessed.class || {};
						}
						
						if (!form.inputs.hasOwnProperty(cellProcessed.name))
							form.connect(cellProcessed.name, cellProcessed.opt);
						cellProcessed.input = form.inputs[cellProcessed.name];

						out.push(depth ? cellProcessed : [cellProcessed]);
					}
				}

				return out;
			};

			return {
				processedRows: connect(inputs, 0)
			};
		},
		methods: {
			joinCls(...classes) {
				const out = {};

				for (let i = 0, l = classes.length; i < l; i++) {
					let clsData = classes[i];

					if (typeof clsData == "function")
						clsData = clsData.call(this, this.form);

					if (typeof clsData == "string")
						clsData = clsData.trim().split(/\s+/);

					if (Array.isArray(clsData)) {
						for (let j = clsData.length - 1; j >= 0; j--) {
							const cl = clsData[j];

							if (typeof cl == "string")
								out[cl] = true;
						}
					} else if (clsData && clsData.constructor == Object)
						Object.assign(out, clsData);
				}

				return out;
			},
			res(val) {
				if (typeof val == "function")
					return val.call(this, this.form);

				return val;
			}
		},
		components: {
			Input,
			Checkbox,
			Count,
			Dropdown,
			Radio
		},
		props: {
			form: Form, 
			rows: [Array, Object]
		}
	};
</script>

<style lang="scss">
	.input-row {
		display: flex;
		align-items: flex-end;

		+ .input-row {
			margin-top: 15px;
		}

		.input-wrapper {
			position: relative;
		}

		.input-box {
			flex-grow: 1;

			+ .input-box {
				margin-left: 20px;
			}

			p {
				margin: 0;
				font-size: 75%;
				text-transform: uppercase;
				margin-bottom: 4px;
			}
		}
	}
</style>
