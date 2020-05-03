<template lang="pug">
	svg.adm-icon(v-if="nameIs('qtxr-logo')"
		:class="compName"
		viewBox="0 0 400 400"
		xmlns="http://www.w3.org/2000/svg")
		path.qtxr-loop(d="M212.9,334.4c-4.3,0.4-8.6,0.6-13,0.6c-74.2,0-134.3-60.1-134.3-134.3c0-74.2,60.1-134.3,134.3-134.3c74.2,0,134.3,60.1,134.3,134.3c0,36.5-14.8,71.4-41.1,96.7c12.4,8.1,26.3,13.6,40.9,16.2c26.9-31.5,41.6-71.5,41.5-112.9c0-96.6-78.6-174.8-175.5-174.8S24.5,104.2,24.5,200.8S103.1,375.6,200,375.6c18,0,35.9-2.7,53.1-8.2C238.3,358.2,224.7,347.1,212.9,334.4z")
		path.qtxr-comma(d="M354.4,334.8c-66.8,0-123.2-49.1-132.8-114.8H275v-40l-150,0.2V220h55.2c9.7,87.4,84.1,155.3,174.4,155.3c7,0,14-0.4,20.9-1.2v-40.9C368.5,334.2,361.5,334.8,354.4,334.8z")
	svg.adm-icon(v-else-if="nameIs('play')"
		:class="compName"
		viewBox="0 0 100 100"
		xmlns="http://www.w3.org/2000/svg")
		path(d="M15 10 l70 40 l-70 40 z")
	svg.adm-icon(v-else-if="nameIs('expand')"
		:class="compName"
		viewBox="0 0 100 100"
		xmlns="http://www.w3.org/2000/svg")
		path(d="M37.1,15H17.9c-1.6,0-2.9,1.3-2.9,2.9v19.2c0,1.6,1.3,2.9,2.9,2.9h1.7c1.6,0,2.9-1.3,2.9-2.9V23.4 c0-0.5,0.4-0.9,0.9-0.9h13.7c1.6,0,2.9-1.3,2.9-2.9v-1.7C40,16.3,38.7,15,37.1,15z M82.1,15H62.9c-1.6,0-2.9,1.3-2.9,2.9v1.7c0,1.6,1.3,2.9,2.9,2.9h13.7c0.5,0,0.9,0.4,0.9,0.9v13.7 c0,1.6,1.3,2.9,2.9,2.9h1.7c1.6,0,2.9-1.3,2.9-2.9V17.9C85,16.3,83.7,15,82.1,15z M82.1,60h-1.7c-1.6,0-2.9,1.3-2.9,2.9v13.7c0,0.5-0.4,0.9-0.9,0.9H62.9c-1.6,0-2.9,1.3-2.9,2.9v1.7 c0,1.6,1.3,2.9,2.9,2.9h19.2c1.6,0,2.9-1.3,2.9-2.9V62.9C85,61.3,83.7,60,82.1,60z M37.1,77.5H23.4c-0.5,0-0.9-0.4-0.9-0.9V62.9c0-1.6-1.3-2.9-2.9-2.9h-1.7c-1.6,0-2.9,1.3-2.9,2.9v19.2 c0,1.6,1.3,2.9,2.9,2.9h19.2c1.6,0,2.9-1.3,2.9-2.9v-1.7C40,78.8,38.7,77.5,37.1,77.5z")
	svg.adm-icon(v-else-if="nameIs('image')"
		:class="compName"
		viewBox="0 0 100 100"
		xmlns="http://www.w3.org/2000/svg")
		path(d="M10,18.1v63.7c0,1.7,1.4,3.1,3.1,3.1h73.7c1.7,0,3.1-1.4,3.1-3.1V18.1c0-1.7-1.4-3.1-3.1-3.1H13.1 C11.4,15,10,16.4,10,18.1z M80.9,75.9l-20-20c-0.5-0.5-1.3-0.5-1.8-0.1L43.7,69c-0.7,0.6-1.7,0.5-2.4-0.1L18.7,46.2 c-0.8-0.8-1.2-1.8-1.2-2.9V24.2c0-0.9,0.8-1.7,1.7-1.7h61.6c0.9,0,1.7,0.8,1.7,1.7v51C82.5,76,81.5,76.5,80.9,75.9z")
		circle(cx="63.8" cy="38.8" r="8.8")
	svg.adm-icon(v-else-if="nameIs('video')"
		:class="compName"
		viewBox="0 0 100 100"
		xmlns="http://www.w3.org/2000/svg")
		polygon(points="35,32.5 70,50 35,67.5")
		path(d="M10,18.1v63.7c0,1.7,1.4,3.1,3.1,3.1h73.7c1.7,0,3.1-1.4,3.1-3.1V18.1c0-1.7-1.4-3.1-3.1-3.1H13.1 C11.4,15,10,16.4,10,18.1z M80.8,77.5H19.2c-0.9,0-1.7-0.8-1.7-1.7V24.2c0-0.9,0.8-1.7,1.7-1.7h61.6c0.9,0,1.7,0.8,1.7,1.7v51.6 C82.5,76.7,81.7,77.5,80.8,77.5z")
	svg.adm-icon(v-else-if="nameIs('cross')"
		:class="compName"
		viewBox="0 0 100 100"
		xmlns="http://www.w3.org/2000/svg")
		path(d="M74.1,30.4l-4.6-4.6c-1.1-1.1-3-1.1-4.2,0L50,41.3L34.6,25.9c-1.1-1.1-3-1.1-4.2,0l-4.6,4.6 c-1.1,1.1-1.1,3,0,4.2L41.3,50L25.9,65.4c-1.1,1.1-1.1,3,0,4.2l4.6,4.6c1.1,1.1,3,1.1,4.2,0L50,58.7l15.4,15.4c1.1,1.1,3,1.1,4.2,0 l4.6-4.6c1.1-1.1,1.1-3,0-4.2L58.7,50l15.4-15.4C75.3,33.5,75.3,31.6,74.1,30.4z")
	svg.adm-icon(v-else-if="nameIs('hammer')"
		:class="compName"
		viewBox="0 0 100 100"
		xmlns="http://www.w3.org/2000/svg")
		path(d="M50.3,17.7l-3.4,2.9c-0.3,0.3-0.6,0.7-0.6,1.2l-0.2,1.8c0,0.5-0.3,0.9-0.6,1.2L39,30.1 c-0.6,0.5-1.4,0.6-2,0.3l-0.7-0.3c-0.3-0.1-0.7-0.1-0.9,0.1l-2.7,2.2c-0.3,0.2-0.4,0.6-0.3,0.9l0.2,0.8c0.2,0.7-0.1,1.5-0.6,2 l-6.5,5.4C25,41.9,24.6,42,24.1,42l-1.8-0.2c-0.5,0-0.9,0.1-1.3,0.4l-3.4,2.9c-0.7,0.6-0.8,1.7-0.2,2.4l12.6,15 c0.6,0.7,1.7,0.8,2.4,0.2l3.4-2.9c0.3-0.3,0.6-0.7,0.6-1.2l0.2-1.8c0-0.5,0.3-0.9,0.6-1.2l6.6-5.6c0.4-0.4,1.1-0.3,1.4,0.1l21.3,27 c0.5,0.7,1.5,0.8,2.1,0.2l4.7-3.9c0.6-0.5,0.7-1.5,0.2-2.1L50.6,45.8c-0.4-0.4-0.3-1,0.1-1.4l6.6-5.6c0.3-0.3,0.8-0.4,1.3-0.4 l1.8,0.2c0.5,0,0.9-0.1,1.3-0.4l3.4-2.9c0.7-0.6,0.8-1.7,0.2-2.4l-12.6-15C52.1,17.1,51,17,50.3,17.7z")
	svg.adm-icon(v-else-if="nameIs('check')"
		:class="compName"
		viewBox="0 0 100 100"
		xmlns="http://www.w3.org/2000/svg")
		path(d="M75,30.7l4.6,4.7c0.9,0.9,0.9,2.3,0,3.2L43.8,74.2c-0.9,0.9-2.3,0.9-3.2,0L20.4,54 c-0.9-0.9-0.9-2.3,0-3.2l4.6-4.6c0.9-0.9,2.3-0.9,3.2,0l13,13c0.5,0.5,1.4,0.5,1.9,0l28.6-28.6C72.7,29.8,74.1,29.8,75,30.7z")
	svg.adm-icon(v-else-if="nameIs('hamburger')"
		:class="compName"
		viewBox="0 0 100 100"
		xmlns="http://www.w3.org/2000/svg")
		path(d="M30 40 h40 M30 50 h40 M30 60 h40")
	svg.adm-icon(v-else-if="nameIs('ellipsis')"
		:class="compName"
		viewBox="0 0 100 100"
		xmlns="http://www.w3.org/2000/svg")
		circle(cx="50" cy="50" r="10")
		circle(cx="80" cy="50" r="10")
		circle(cx="20" cy="50" r="10")
	svg.adm-icon(v-else-if="nameIs('thin-cross')"
		:class="compName"
		viewBox="0 0 100 100"
		xmlns="http://www.w3.org/2000/svg")
		path(d="M30 30 l40 40 M70 30 l-40 40")
	.adm-icon(v-else key="placeholder")
</template>

<script>
	import admin from "../admin";

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
						this.processedName = cl[i].substring(4);
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
		components: {},
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
	@use "../assets/scss" as *;

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
		&.ico-logo,
		&.ico-play,
		&.ico-image {
			stroke: none;
		}

		&.ico-hamburger,
		&.ico-thin-cross {
			stroke-width: 3;
		}
		
		// Modifiers
		&.hairline {
			fill: none;
			stroke-width: 0.4;
			stroke-linecap: round;
			stroke-linejoin: round;
		}
	}
</style>
