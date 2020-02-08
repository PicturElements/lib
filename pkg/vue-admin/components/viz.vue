<template lang="pug">
	.v-viz-wrapper
		.v-viz(v-once ref="root")
		slot(name="loading-box")
			LoadingBox.semi-transparent.v-viz-loading-box(
				v-if="$scopedSlots['loading-icon']"
				:cell="cell")
				slot(name="loading-icon")
</template>

<script>
	import { get } from "@qtxr/utils";
	import Viz from "@qtxr/viz";
	import DataCell from "@qtxr/data-cell";

	import LoadingBox from "./loading-box.vue";

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
			cell: DataCell,
			accessor: [String, Array]
		},
		components: {
			LoadingBox
		},
		mounted() {
			this.viz = new Viz(this.$refs.root, this.config);
			this.resizeHandler = _ => this.viz.hardUpdate();

			window.addEventListener("resize", this.resizeHandler);

			const setData = d => {
				if (this.accessor)
					this.viz.setData(get(d, this.accessor));
				else
					this.viz.setData(d);
			};

			if (this.cell instanceof DataCell) {
				this.cell.hook("setData", (cell, data) => setData(data));

				if (this.cell.state.loaded && this.cell.data)
					setData(this.cell.data);

				this.cell.hook("stateUpdate:loading", (cell, loading) => {
					this.viz.loading = loading;
				})
		 	} else if (this.data)
				setData(this.data);
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
