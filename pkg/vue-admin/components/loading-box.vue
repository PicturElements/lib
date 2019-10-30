<template lang="pug">
	transition(name="loading-fade")
		.loading-box.f.c(v-if="isLoading")
			slot
</template>

<script>
	import DataCell from "@qtxr/data-cell";

	export default {
		name: "LoadingBox",
		computed: {
			isLoading() {
				if (this.cell instanceof DataCell)
					return this.cell.state.loading;

				return this.loading;
			}
		},
		props: {
			cell: DataCell,
			loading: Boolean
		}
	}
</script>
