<template lang="pug">
	.input-wrapper.coordinates.inp-coordinates(:class="validationState")
		.map-wrapper
			.pad-box-wrapper
				.pad-box
			.map(
				v-once
				ref="map")
		.validation-msg(:class="validationMsg ? 'active' : null") {{ validationMsg }}
</template>

<script>
	import { Coordinates } from "@qtxr/form";
	import mixin from "../mixin";

	export default {
		name: "Coordinates",
		mixins: [mixin],
		data: _ => ({
			map: null,
			marker: null
		}),
		methods: {
			trigger(coords) {
				if (!this.disabled)
					this.input.trigger(coords);
			}
		},
		props: {
			input: Coordinates,
			placeholder: String
		},
		watch: {
			"input.value"() {
				console.log("hmmm");
				this.marker.setPosition(this.input.value);
				this.map.panTo(this.input.value);
			}
		},
		mounted() {
			if (!google.maps)
				return;

			const coords = this.input.value || { lat: 0, lng: 0 };

			const map = new google.maps.Map(
				this.$refs.map,
				Object.assign(this.input.mapOptions || {}, {
					zoom: 1,
					center: coords,
					draggableCursor: "pointer"
				})
			);

			const marker = new google.maps.Marker(
				Object.assign(this.input.markerConfig || {}, {
					position: coords,
					map: map,
					animation: google.maps.Animation.DROP,
					draggable: true
				})
			);

			google.maps.event.addListener(map, "click", evt => {
				marker.setPosition(evt.latLng);
				this.trigger({
					lat: evt.latLng.lat(),
					lng: evt.latLng.lng()
				});
			});

			google.maps.event.addListener(marker, "dragend", evt => {
				this.trigger({
					lat: evt.latLng.lat(),
					lng: evt.latLng.lng()
				});
			});

			this.map = map;
			this.marker = marker;
			window.map = map;
			window.marker = marker;
		}
	}
</script>
