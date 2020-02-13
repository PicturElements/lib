<template lang="pug">
	.input-wrapper.coordinates.inp-coordinates(:class="[ searchEnabled ? 'search-enabled' : null, coordsEnabled ? 'coords-enabled' : null, validationState ]")
		.map-wrapper
			.pad-box-wrapper
				.pad-box
			.map(
				v-once
				ref="map")
			.loading-overlay(v-if="loading")
				slot(name="loading-icon" v-bind="this")
		.coords-box(v-if="coordsEnabled")
			input(
				v-model="coordsStr"
				:disabled="disabled"
				@change="setValueFromCoords"
				@keydown="guardInput($event, true)")
		.search-box(v-if="searchEnabled")
			.run-btn-wrapper.run-geolocation
				button.run-btn(
					:disabled="geolocationDenied || runningGeolocation"
					:class="{ active: runningGeolocation }"
					@click="runGeolocation")
					svg.run-icon.geolocation-icon
						slot(name="geolocation-icon" v-bind="this")
							svg(viewBox="0 0 10 10")
								circle(cx="5" cy="5" r="3.5")
								path(d="M5 0 v4 M5 10 v-4 M0 5 h4 M10 5 h-4")
			input(
				v-model="query"
				:placeholder="res(input.placeholder || placeholder)"
				:disabled="disabled"
				@keydown="guardInput")
			.run-btn-wrapper.run-search
				button.run-btn(
					:disabled="!query || runningSearch || disabled"
					:class="{ active: runningSearch }"
					@click="runSearch")
					svg.run-icon.search-icon
						slot(name="search-icon" v-bind="this")
							svg(viewBox="0 0 10 10")
								circle(cx="6" cy="4" r="3.5")
								path(d="M3.5 6.5 l-2.5 2.5")
		.validation-msg(:class="validationMsg ? 'active' : null") {{ validationMsg }}
</template>

<script>
	import { Coordinates } from "@qtxr/form";
	import EVT from "@qtxr/evt";
	import mixin from "../mixin";

	export default {
		name: "Coordinates",
		mixins: [mixin],
		data: _ => ({
			map: null,
			marker: null,
			placesService: null,
			query: "",
			coordsStr: "",
			runningSearch: false,
			runningGeolocation: false,
			geolocationDenied: false,
			initialized: false
		}),
		methods: {
			trigger(coords) {
				if (!this.disabled)
					this.input.trigger(coords);
			},
			runSearch() {
				this.runningSearch = true;
				
				const request = {
					query: this.query,
					fields: ["geometry"]
				};

				this.placesService.findPlaceFromQuery(request, (results, status) => {
					if (status == google.maps.places.PlacesServiceStatus.OK && results && results[0]) {
						const result = results[0],
							cData = {
								lat: result.geometry.location.lat(),
								lng: result.geometry.location.lng()
							};

						this.marker.setPosition(cData);
						this.map.fitBounds(result.geometry.viewport);
						this.trigger(cData);
					}

					this.runningSearch = false;
				});
			},
			runGeolocation() {
				this.runningGeolocation = true;

				navigator.geolocation.getCurrentPosition(data => {
					const cData = {
						lat: data.coords.latitude,
						lng: data.coords.longitude
					};

					this.map.panTo(cData);
					this.map.setZoom(15);
					this.runningGeolocation = false;

					if (!this.disabled) {
						this.marker.setPosition(cData);
						this.trigger(cData);
					}
				}, error => {
					if (error.code == 1)
						this.geolocationDenied = true;

					this.runningGeolocation = false;
				})
			},
			guardInput(evt, noSearch) {
				if (this.loading) {
					switch (EVT.getKey(evt)) {
						case "escape":
						case "tab":
							break;

						default:
							evt.preventDefault();
					}
				} else switch (EVT.getKey(evt)) {
					case "enter":
						if (this.query && !noSearch)
							this.runSearch();
						break;
				}
			},
			setValueFromCoords() {
				this.input.value = this.coordsStr;
			}
		},
		computed: {
			coordsEnabled() {
				return !this.input.noCoords;
			},
			searchEnabled() {
				return this.initialized && !this.input.noSearch;
			},
			geolocationEnabled() {
				return ("geolocation" in navigator) && !this.input.noGeolocation;
			},
			loading() {
				return this.runningSearch || this.runningGeolocation;
			}
		},
		props: {
			input: Coordinates,
			placeholder: String
		},
		watch: {
			"input.value"(val) {
				if (!this.initialized)
					return;

				if (val) {
					this.marker.setMap(this.map);
					this.marker.setPosition(this.input.value);
					this.map.panTo(this.input.value);
				} else
					this.marker.setMap(null);

				if (this.coordsEnabled)
					this.coordsStr = this.input.extract("string");
			},
			disabled(disabled) {
				if (!this.initialized)
					return;

				this.marker.setDraggable(!disabled);
			}
		},
		mounted() {
			if (typeof google == "undefined" || !google.maps)
				return;

			const coords = this.input.value || { lat: 0, lng: 0 };

			const map = new google.maps.Map(
				this.$refs.map,
				Object.assign({
					zoom: 2,
					center: coords,
					draggableCursor: "pointer"
				}, this.input.mapOptions)
			);

			const marker = new google.maps.Marker(
				Object.assign({
					position: coords,
					animation: google.maps.Animation.DROP
				}, this.input.markerConfig)
			);

			marker.setDraggable(!this.disabled);

			if (this.input.value)
				marker.setMap(map);

			google.maps.event.addListener(map, "click", evt => {
				if (this.disabled)
					return;

				marker.setPosition(evt.latLng);
				this.trigger({
					lat: evt.latLng.lat(),
					lng: evt.latLng.lng()
				});
			});

			google.maps.event.addListener(marker, "dragend", evt => {
				if (this.disabled)
					return;

				this.trigger({
					lat: evt.latLng.lat(),
					lng: evt.latLng.lng()
				});
			});

			this.map = map;
			this.marker = marker;
			this.initialized = true;
			if (this.coordsEnabled)
				this.coordsStr = this.input.extract("string");

			// Optionally enable searching through the Places API
			if (google.maps.places)
				this.placesService = new google.maps.places.PlacesService(map);
		}
	}
</script>
