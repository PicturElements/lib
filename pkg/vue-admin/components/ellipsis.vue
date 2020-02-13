<template lang="pug">
	Drop.ellipsis(
		:items="options"
		:data="data"
		:justify="justify")
		template(#launcher-content)
			slot(name="icon") ⋯
		template(#default="{ item, disabled }")
			.ellipsis-menu-item(@click="evt => dispatchAction(evt, item, disabled)") {{ res(item.title, item) }}
</template>

<script>
	import Drop from "./drop.vue";

	export default {
		name: "Ellipsis",
		methods: {
			dispatchAction(evt, option, disabled) {
				if (disabled)
					evt.stopPropagation();
				else if (typeof option.action == "function")
					option.action(option, ...this.processedArgs);
			},
			res(val, option) {
				if (typeof val == "function")
					return val.call(this, option, ...this.processedArgs);

				return val;
			}
		},
		computed: {
			processedArgs() {
				if (this.args) {
					if (!Array.isArray(this.args))
						return [this.args];

					return this.args;
				}

				return [this.data];
			}
		},
		props: {
			options: Array,
			data: null,
			args: Array,
			justify: {
				type: String,
				default: "right"
			}
		},
		components: {
			Drop
		}
	};
</script>
