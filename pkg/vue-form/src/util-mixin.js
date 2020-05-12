import {
	get,
	inject,
	hasOwn,
	isObject,
	joinClass
} from "@qtxr/utils";

export default {
	methods: {
		jc: joinClass,
		cl(...classes) {
			return joinClass({
				disabled: this.dis,
				readonly: this.ro,
				mobi: this.isMobile()
			}, this.validationState, ...classes);
		},
		prp(...propObjects) {
			const outProps = {};

			for (let i = 0, l = propObjects.length; i < l; i++) {
				const props = propObjects[i];
				if (isObject(props))
					Object.assign(outProps, props);
			}
		},
		mkRuntime(...sources) {
			const input = this.input,
				form = input && input.form;

			const runtime = {
				self: this,
				input,
				form,
				rootForm: form,
				inputs: form && form.inputs,
				rootInputs: form && form.inputs,
				inputsStruct: form && form.inputsStruct,
				rootInputsStruct: form && form.inputsStruct,
				value: input && input.value
			};

			for (let i = 0, l = sources.length; i < l; i++) {
				const src = sources[i];

				if (typeof src == "string") {
					const [
						key,
						path = "input.value"
					] = src.split(":");

					runtime[key] = get(runtime, path);
				} else if (isObject(src))
					inject(runtime, src, "override");
			}

			return runtime;
		},
		res(val, ...args) {
			if (typeof val == "function")
				return val.call(this, this.mkRuntime(), ...args);
		
			return val;
		},
		bind(...sources) {
			return this.mkRuntime(...sources);
		},
		isMobile() {
			const mobileQuery = this.mobileQuery || this.meta.mobileQuery || "(max-aspect-ratio: 1/1) and (max-width: 700px)";
			return matchMedia(mobileQuery).matches;
		},
		slotNames(filterer) {
			const slots = this.$scopedSlots,
				names = [];

			if (filterer instanceof RegExp) {
				for (const k in slots) {
					if (hasOwn(slots, k) && filterer.test(k))
						names.push(k);
				}
			} else if (typeof filterer == "function") {
				for (const k in slots) {
					if (hasOwn(slots, k) && filterer(k, slots))
						names.push(k);
				}
			}

			return names;
		},
		handlePattern(evt) {
			const handler = this.input.handlers.patterns || this.input.handlers.pattern;
			if (!handler)
				return;

			const res = handler(evt),
				target = evt.target;

			if (!res.prevent)
				return;

			target.value = res.output;
			target.selectionStart = res.start;
			target.selectionEnd = res.end;
			evt.preventDefault();

			if (!this.inert)
				this.input.trigger(res.output);
		}
	},
	computed: {
		bnd() {
			return this.bind();
		},
		classes() {
			return this.cl();
		},
		dis() {
			return this.disabled == "boolean" ?
				this.disabled :
				this.input.disabled;
		},
		ro() {
			return this.readonly == "boolean" ?
				this.readonly :
				this.input.readonly;
		},
		ac() {
			if (this.input.bare === false || (!this.input.form.options.bareInputs && !this.input.bare))
				return null;
		
			return "off";
		},
		inert() {
			return this.dis || this.ro;
		},
		inpProps() {
			return {
				disabled: this.dis,
				readonly: this.ro
			};
		},
		inpPropsFull() {
			return {
				disabled: this.dis,
				readonly: this.ro,
				autocomplete: this.ac,
				name: this.input.name,
				placeholder: this.res(this.input.placeholder || this.placeholder)
			};
		},
		propPassthrough() {
			return {
				input: this.input,
				disabled: this.dis,
				readonly: this.ro,
				meta: this.meta
			};
		}
	}
};
