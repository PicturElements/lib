<template lang="pug">
	.util-box
		.util-box-header.f.jsb.ac
			.util-box-header-left.f.ac
				.util-box-title-box.f.ac
					slot(name="title-pre" v-bind="this")
					.util-box-title
						slot(name="title" v-bind="this")
					slot(name="title-post" v-bind="this")
			.util-box-header-right.f.ac
				.util-box-header-utils.f.ac
					slot(name="header-utils-pre" v-bind="this")
					slot(name="header-utils" v-bind="this")
						slot(name="header-utils-reload" v-bind="this")
							button.admin-btn.square.expand-disabled.fade-color.reload(
								v-if="config.reload"
								:disabled="cell.state.loading"
								@click="cell.fetch()")
								slot(name="header-utils-reload-icon" v-bind="this") ↻
					slot(name="header-utils-post" v-bind="this")
		.util-box-content
			.util-box-main-content
				slot(v-bind="this")
			slot(name="loading-box" v-bind="this")
				LoadingBox.semi-transparent(
					v-if="$scopedSlots['loading-icon']"
					:cell="cell")
					slot(name="loading-icon" v-bind="this")
		.util-box-footer.f.jsb.ac(v-if="$scopedSlots['footer']")
			slot(name="footer" v-bind="this")
</template>

<script>
	import DataCell from "@qtxr/data-cell";

	import LoadingBox from "./loading-box";

	export default {
		name: "UtilBox",
		data: _ => ({}),
		methods: {},
		computed: {},
		props: {
			config: {
				type: Object,
				default: _ => ({
					reload: true
				})
			},
			cell: DataCell
		},
		components: {
			LoadingBox
		},
		mounted() {
			console.log(this);
		}
	};
</script>