<template lang="pug">
	svg.adm-icon(v-if="nameIs('qtxr-logo')"
		:class="compName"
		viewBox="0 0 400 400"
		xmlns="http://www.w3.org/2000/svg")
		path.qtxr-loop(d="M212.9,334.4c-4.3,0.4-8.6,0.6-13,0.6c-74.2,0-134.3-60.1-134.3-134.3c0-74.2,60.1-134.3,134.3-134.3c74.2,0,134.3,60.1,134.3,134.3c0,36.5-14.8,71.4-41.1,96.7c12.4,8.1,26.3,13.6,40.9,16.2c26.9-31.5,41.6-71.5,41.5-112.9c0-96.6-78.6-174.8-175.5-174.8S24.5,104.2,24.5,200.8S103.1,375.6,200,375.6c18,0,35.9-2.7,53.1-8.2C238.3,358.2,224.7,347.1,212.9,334.4z")
		path.qtxr-comma(d="M354.4,334.8c-66.8,0-123.2-49.1-132.8-114.8H275v-40l-150,0.2V220h55.2c9.7,87.4,84.1,155.3,174.4,155.3c7,0,14-0.4,20.9-1.2v-40.9C368.5,334.2,361.5,334.8,354.4,334.8z")
	div.adm-icon(v-else key="placeholder")
</template>

<script>
	import admin from "../admin";
	import * as components from "@qtxr/vue-admin/components";

	const component = admin.wrapC({
		name: "Icon",
		data: {
			class: null,
			processedName: null
		},
		methods: {
			nameIs(name) {
				return this.processedName == name;
			},
			updateName() {
				const cl = this.$el.classList;

				if (this.$props.name) {
					this.processedName = this.$props.name;
					return;
				}

				for (let i = 1, l = cl.length; i < l; i++) {
					if (cl[i].indexOf("ico-") == 0) {
						this.processedName = cl[i].substr(4);
						break;
					}
				}
			}
		},
		computed: {
			compName() {
				return this.$props.name ? `ico-${this.$props.name}` : null;
			}
		},
		props: {
			name: String
		},
		components: {
			...components
		},
		mounted() {
			this.updateName();
		},
		updated() {
			this.updateName();
		}
	});

	export default component.export();
</script>

<style lang="scss">
	@use "../assets/scss/theme.scss" as *;

	.adm-icon {
		display: inline-block;
		vertical-align: middle;
		fill: currentColor;
		stroke: currentColor;

		&.small {
			height: 20px;
		}

		&.em {
			height: 1em;
		}

		// Individual icons
		
		
		// Modifiers
		&.hairline {
			fill: none;
			stroke-width: 0.4;
			stroke-linecap: round;
			stroke-linejoin: round;
		}
	}
</style>
