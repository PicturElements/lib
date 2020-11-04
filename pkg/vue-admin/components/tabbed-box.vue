<template lang="pug">
	UtilBox.tabbed-box
		template(#title)
			nav.tabbed-nav(v-if="routes")
				router-link.tabbed-nav-item(
					v-for="route in routes"
					:to="route.path") {{ route.name }}
			nav.tabbed-nav
				button.tabbed-nav-item(
					v-for="(tab, i) in tbs"
					:class="{ selected: i == idx }"
					@click="select(tab)")
					slot(
						:name="tab.name"
						v-bind="slotData")
						slot(
							:name="`t-${tab.name}`"
							v-bind="slotData")
							slot(
								name="tab"
								v-bind="slotData")
								span {{ tab.title }}
		slot(
			v-if="routes || idx > -1"
			v-bind="slotData")
</template>

<script>
	import {
		hasOwn,
		matchType
	} from "@qtxr/utils";

	export default {
		name: "TabbedBox",
		data() {
			return {
				tbs: [],
				idx: -1
			};
		},
		methods: {
			updateTabsData() {
				const tabs = this.tabs,
					tbs = [],
					names = {};

				if (tabs) {
					for (let i = 0, l = tabs.length; i < l; i++) {
						const tab = Object.assign({}, tabs[i]),
							name = matchType(tab.name, "string|number") ?
								tab.name :
								i;

						if (hasOwn(names, name))
							throw new Error(`Cannot construct tabbed box: duplicate tab name '${name}'`);

						tab.name = name;
						tab.source = tabs[i];
						tbs.push(tab)
						names[name] = true;
					}
				}

				this.tbs = tbs;
				this.idx = this.getTabIdx(tbs, this.tab);
			},
			getTabIdx(tabs, identifier) {
				for (let i = 0, l = tabs.length; i < l; i++) {
					const tab = tabs[i];

					switch (typeof identifier) {
						case "number":
						case "string":
							if (tab.name == identifier)
								return i;
							break;

						case "object":
							if (!identifier)
								return -1;

							if (tab.source == identifier || (identifier.name && tab.name == identifier.name))
								return i;
					}
				}

				if (typeof identifier == "number" && hasOwn(tabs, identifier))
					return identifier;

				return -1;
			},
			select(tab) {
				this.$emit("select", tab);
			}
		},
		computed: {
			slotData() {
				return {
					tab: this.tbs[this.idx],
					tabs: this.tbs,
					index: this.idx
				};
			}
		},
		watch: {
			tab(to) {
				this.idx = this.getTabIdx(this.tbs, to);
			},
			tabs() {
				this.updateSlidesData();
			}
		},
		props: {
			routes: Array,
			tabs: Array,
			tab: [Object, String, Number]
		},
		beforeMount() {
			this.updateTabsData();
		}
	};
</script>
