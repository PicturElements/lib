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
								v-if="conf.reload"
								:disabled="cell.state.loading"
								@click="cell.fetch()")
								slot(name="header-utils-reload-icon" v-bind="this") ↻
					slot(name="header-utils-post" v-bind="this")
		.util-box-sub-header(v-if="$scopedSlots['sub-header']")
			slot(name="sub-header" v-bind="this")
		.util-box-content(ref="content")
			.util-box-main-content
				template(v-if="$scopedSlots['cell-data']")
					slot(
						name="cell-data"
						v-if="cell.state.loaded || cell.state.fetches"
						v-bind="cell.data")
				slot(v-else v-bind="this")
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
		data() {
			return {
				conf: Object.assign({
					reload: true
				}, this.config)
			};
		},
		methods: {},
		computed: {},
		props: {
			config: Object,
			cell: DataCell
		},
		components: {
			LoadingBox
		}
	};
</script>
