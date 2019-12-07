<template lang="pug">
	.v-form
		.input-row(
			v-for="(row, idx) in processedRows"
			:class="`input-row-${idx}`")
			.input-box(
				v-for="cell in row"
				:class="joinCls(cell.class.box, `input-box-${cell.input.type || 'text'}`)"
				:data-name="cell.input.name")
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
						:label="res(cell.label)"
						:meta="inputMeta")
						template(#icon="inp")
							slot(:name="`${cell.input.name}-icon`" v-bind="inp")
								slot(name="checkbox-icon" v-bind="inp")
				template(v-else-if="cell.input.type == 'count'")
					Count(
						:class="cell.class.input"
						:input="cell.input"
						:symbols="res(cell.symbols)"
						:meta="inputMeta")
						template(#down-symbol="inp")
							slot(:name="`${cell.input.name}-down-symbol`" v-bind="inp")
								slot(name="count-down-symbol" v-bind="inp")
						template(#up-symbol="inp")
							slot(:name="`${cell.input.name}-up-symbol`" v-bind="inp")
								slot(name="count-up-symbol" v-bind="inp")
				template(v-else-if="cell.input.type == 'dropdown'")
					Dropdown(
						:class="cell.class.input"
						:input="cell.input"
						:placeholder="res(cell.placeholder)"
						:meta="inputMeta")
						template(v-slot="option")
							slot(:name="`${cell.input.name}-option`" v-bind="option")
								slot(name="dropdown-option" v-bind="option")
						template(#icon="data")
							slot(:name="`${cell.input.name}-icon`" v-bind="data")
								slot(name="dropdown-icon" v-bind="data")
				template(v-else-if="cell.input.type == 'formatted'")
					Formatted(
						:class="cell.class.input"
						:input="cell.input"
						:meta="inputMeta")
				template(v-else-if="cell.input.type == 'media'")
					Media(
						:class="cell.class.input"
						:input="cell.input"
						:meta="inputMeta")
						template(#upload-icon)
							slot(:name="`${cell.input.name}-upload-icon`")
								slot(name="upload-icon")
						template(#upload-icon-fill)
							slot(:name="`${cell.input.name}-upload-icon-fill`")
								slot(name="upload-icon-fill")
						template(#upload-icon-outline)
							slot(:name="`${cell.input.name}-upload-icon-outline`")
								slot(name="upload-icon-outline")
						template(#upload-icon-ripple)
							slot(:name="`${cell.input.name}-upload-icon-ripple`")
								slot(name="upload-icon-ripple")
						template(#loading-icon)
							slot(:name="`${cell.input.name}-loading-icon`")
								slot(name="loading-icon")
						template(#upload-message)
							slot(:name="`${cell.input.name}-upload-message`")
								slot(name="upload-message")
						template(#error-message)
							slot(:name="`${cell.input.name}-error-message`")
								slot(name="error-message")
				template(v-else-if="cell.input.type == 'multi'")
					Multi(
						:class="cell.class.input"
						:input="cell.input"
						:meta="inputMeta")
						template(
							v-if="$scopedSlots['selection-item'] || $scopedSlots[`${cell.input.name}-selection-item`]"
							#selection-item="d")
								slot(:name="`${cell.input.name}-selection-item`" v-bind="d")
									slot(name="selection-item" v-bind="d")
						template(#selection-item-value="d")
								slot(:name="`${cell.input.name}-selection-item-value`" v-bind="d")
									slot(name="selection-item-value" v-bind="d")
						template(
							v-if="$scopedSlots['search-result'] || $scopedSlots[`${cell.input.name}-search-result`]"
							#search-result="d")
								slot(:name="`${cell.input.name}-search-result`" v-bind="d")
									slot(name="search-result" v-bind="d")
						template(#search-result-value="d")
								slot(:name="`${cell.input.name}-search-result-value`" v-bind="d")
									slot(name="search-result-value" v-bind="d")
						template(#no-search-results="inp")
							slot(:name="`${cell.input.name}-no-search-results`")
								slot(name="no-search-results")
						template(#loading-icon)
							slot(:name="`${cell.input.name}-loading-icon`")
								slot(name="loading-icon")
				template(v-else-if="cell.input.type == 'radio'")
					Radio(
						:class="cell.class.input"
						:input="cell.input"
						:meta="inputMeta")
						template(#label="option")
							slot(:name="`${cell.input.name}-label`" v-bind="option")
								slot(name="radio-label" v-bind="option")
						template(#custom-content="option")
							slot(:name="`${cell.input.name}-custom-content`" v-bind="option")
								slot(name="radio-custom-content" v-bind="option")
				template(v-else-if="cell.input.type == 'textarea'")
					TextArea(
						:class="cell.class.input"
						:input="cell.input"
						:placeholder="res(cell.placeholder)"
						:meta="inputMeta")
				template(v-else-if="cell.input.type == 'time'")
					Time(
						:class="cell.class.input"
						:input="cell.input"
						:meta="inputMeta")
				template(v-else)
					Input(
						:class="cell.class.input"
						:input="cell.input"
						:placeholder="res(cell.placeholder)"
						:meta="inputMeta")
				slot(:name="`${cell.input.name}-post-content`" v-bind="cell.input")
					slot(name="post-content" v-bind="cell.input")
</template>

<script>
	import Form from "@qtxr/form";
	
	import Input from "./inputs/input.vue";
	import Checkbox from "./inputs/checkbox.vue";
	import Count from "./inputs/count.vue";
	import Dropdown from "./inputs/dropdown.vue";
	import Formatted from "./inputs/formatted.vue";
	import Media from "./inputs/media.vue";
	import Multi from "./inputs/multi.vue";
	import Radio from "./inputs/radio.vue";
	import TextArea from "./inputs/textarea.vue";
	import Time from "./inputs/time.vue";

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

						const options = cellProcessed.opt;
						delete cellProcessed.opt;
						
						if (!form.inputs.hasOwnProperty(cellProcessed.name))
							form.connect(cellProcessed.name, options);
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
		computed: {
			inputMeta() {
				return {
					mobileQuery: this.mobileQuery
				}
			}
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
			res(val, ...args) {
				if (typeof val == "function")
					return val.call(this, this.form, ...args);

				return val;
			}
		},
		components: {
			Input,
			Checkbox,
			Count,
			Dropdown,
			Formatted,
			Media,
			Multi,
			Radio,
			TextArea,
			Time
		},
		props: {
			form: Form, 
			rows: [Array, Object],
			mobileQuery: {
				type: String,
				default: "(max-aspect-ratio: 1/1) and (max-width: 700px)"
			}
		}
	};
</script>

<style lang="scss">
	.input-row {
		display: flex;
		align-items: flex-end;

		.input-box-textarea {
			align-self: flex-start;
		}

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
