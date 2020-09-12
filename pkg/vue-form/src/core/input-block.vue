<template lang="pug">
	.input-block(
		:is="blockTag"
		:class="classes"
		role="form")
		template(v-for="(block, idx) in blocks")
			InputBlock(
				v-if="block.isInputBlock"
				:blocks="block",
				:order="mkOrder(idx)"
				:mobileQuery="mobileQuery")
				template(
					v-for="(_, name) in $scopedSlots"
					#[name]="d")
					slot(:name="name" v-bind="d")
			.input-box(
				v-else-if="block.input.visible"
				:class="jc(block.class.box, `input-box-${block.input.type || 'text'}`)"
				:data-name="block.input.name")
				label.title(
					v-if="block.title"
					:id="block.input.uid + '-title'"
					:class="jc({ required: block.input.required }, block.class.title)"
					:for="block.input.uid")
						| {{ res(block, block.title) }}
				label.aria-title(
					v-else
					:id="block.input.uid + '-title'"
					:for="block.input.uid")
						| {{ block.input.dict('label') || block.input.name }}
				slot(:name="`${block.input.name}-pre-content`" v-bind="bind(block)")
					slot(name="pre-content" v-bind="bind(block)")
				InputWrapper(
					:class="block.class.input"
					:cell="block"
					:meta="inputMeta"
					:verifiedVisibility="true"
					:disabled="block.input.disabled"
					:readonly="block.input.readonly"
					:key="block.input.id")
					template(
						v-for="(_, name) in $scopedSlots"
						#[name]="d")
						slot(:name="name" v-bind="d")
				slot(:name="`${block.input.name}-post-content`" v-bind="bind(block)")
					slot(name="post-content" v-bind="bind(block)")
</template>

<script>
	import InputWrapper from "./input-wrapper.vue";
	import utilMixin from "../util-mixin";

	export default {
		name: "InputBlock",
		mixins: [utilMixin],
		methods: {
			mkRuntime(block) {
				return {
					self: this,
					input: block.input,
					form: block.input.form,
					rootForm: block.input.form,
					inputs: block.input.form.inputs,
					rootInputs: block.input.form.inputs,
					inputsStruct: block.input.form.inputsStruct,
					rootInputsStruct: block.input.form.inputsStruct,
					value: block.input.value
				};
			},
			res(block, val, ...args) {
				if (typeof val == "function")
					return val.call(this, this.mkRuntime(block), ...args);

				return val;
			},
			bind(block) {
				return this.mkRuntime(block);
			},
			mkOrder(idx) {
				return this.order.concat(idx);
			}
		},
		computed: {
			blockTag() {
				const ua = (window.navigator && navigator.userAgent) || "",
					usesDumbBrowser = ua.indexOf("Safari") != -1 && ua.indexOf("Chrome") == -1;

				return !this.root || usesDumbBrowser ?
					"div" :
					"form";
			},
			inputMeta() {
				return {
					mobileQuery: this.mobileQuery
				}
			},
			classes() {
				const classes = [];

				if (this.blocks && this.blocks.type) {
					const blockType = `input-${this.blocks.type}`
					classes.push(blockType);

					if (this.order.length) {
						classes.push(
							`${blockType}-${this.order.join("-")}`,
							`depth-${this.order.length}`
						);
					}
				}

				return classes;
			}
		},
		components: {
			InputWrapper
		},
		props: {
			blocks: Array,
			order: {
				type: Array,
				default: _ => []
			},
			mobileQuery: {
				type: String,
				default: "(max-aspect-ratio: 1/1) and (max-width: 700px)"
			},
			root: Boolean
		}
	};
</script>
