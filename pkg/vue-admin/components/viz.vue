<template lang="pug">
	.v-viz-wrapper
		.v-viz(v-once ref="root")
		slot(name="loading-box")
			LoadingBox.semi-transparent(
				v-if="$scopedSlots['loading-icon']"
				:cell="cell").v-viz-loading-box
				slot(name="loading-icon")
</template>

<script>
	import Viz from "@qtxr/viz";
	import DataCell from "@qtxr/data-cell";

	import LoadingBox from "./loading-box";

	export default {
		name: "Viz",
		data: _ => ({
			viz: null,
			resizeHandler: null
		}),
		methods: {},
		computed: {},
		props: {
			config: {
				type: Object,
				required: true
			},
			data: null,
			cell: DataCell
		},
		components: {
			LoadingBox
		},
		mounted() {
			this.viz = new Viz(this.$refs.root, this.config);
			this.resizeHandler = _ => this.viz.hardUpdate();

			window.addEventListener("resize", this.resizeHandler);

			if (this.cell instanceof DataCell) {
				this.cell.hook("setData", (cell, data) => {
					this.viz.setData(data);
				});

				this.cell.hook("stateUpdate:loading", (cell, loading) => {
					this.viz.loading = loading;
				})
		 	} else if (this.data)
				this.viz.setData(this.data);
		},
		beforeDestroy() {
			window.removeEventListener("resize", this.resizeHandler);
		},
		watch: {
			data(newData) {
				if (newData)
					this.viz.setData(newData);
			}
		}
	};
</script>
