import { sym } from "@qtxr/utils";

const INPUT_HOOK_SYM = sym("input hook");

export default {
	data: _ => ({
		validationMsg: null,
		validationState: "ok"
	}),
	methods: {
		ac() {
			if (this.input.bare === false || (!this.input.form.options.bareInputs && !this.input.bare))
				return null;
		
			return "off";
		},
		res(val, ...args) {
			if (typeof val == "function")
				return val.call(this, this.input, ...args);
		
			return val;
		},
		isMobile() {
			const mobileQuery = this.mobileQuery || this.meta.mobileQuery || "(max-aspect-ratio: 1/1) and (max-width: 700px)";
			return matchMedia(mobileQuery).matches;
		}
	},
	props: {
		disabled: Boolean,
		mobileQuery: String,
		meta: {
			type: Object,
			default: _ => ({})
		}
	},
	beforeMount() {
		this.input.hook("update", inp => {
			this.validationState = inp.validationState;
			this.validationMsg = inp.validationMsg || this.validationMsg;
		}, INPUT_HOOK_SYM);
	},
	beforeDestroy() {
		this.input.unhook({
			nickname: INPUT_HOOK_SYM
		});
	}
};
