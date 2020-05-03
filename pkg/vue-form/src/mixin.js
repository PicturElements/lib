import { sym } from "@qtxr/utils";
import utilMixin from "./util-mixin";

const INPUT_HOOK_SYM = sym("input hook");

export default {
	...utilMixin,
	data: _ => ({
		validationMsg: null,
		validationState: "ok"
	}),
	props: {
		disabled: Boolean,
		readonly: Boolean,
		meta: {
			type: Object,
			default: _ => ({})
		}
	},
	beforeMount() {
		this.input.hook("update", ({ input }) => {
			this.validationState = input.validationState;
			this.validationMsg = input.validationMsg || input.validationMsg;
		}, INPUT_HOOK_SYM);
	},
	beforeDestroy() {
		this.input.unhook({
			nickname: INPUT_HOOK_SYM
		});
	}
};
