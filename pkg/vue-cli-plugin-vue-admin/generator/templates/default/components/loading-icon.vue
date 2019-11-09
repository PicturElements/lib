<template lang="pug">
	.admin-loading-icon.f.c
		.loading-icon-dots
			.loading-dot-row.f
				.loading-dot.dot-1
				.loading-dot.dot-2
			.loading-dot-row.f
				.loading-dot.dot-3
				.loading-dot.dot-4
</template>

<script>
	import admin from "../admin";

	const component = admin.wrapC({
		name: "LoadingIcon",
		data: {},
		methods: {},
		computed: {},
		props: {},
		components: {}
	});

	export default component.export();
</script>

<style lang="scss">
	@use "../assets/scss" as *;

	$dot-radius: 5px;
	$dot-spacing: 8px;
	// Moves the pivot to between two circles
	$dot-half-shift: $dot-radius * 2 + $dot-spacing / 2;
	// Moves the pivot to the next circle
	$dot-full-shift: $dot-radius * 2 + $dot-spacing;
	$animation-duration: 2.5s;

	// Front side circle scale
	$front-normal-scale: 0.7;
	$front-pop-scale: 1;

	// Back side circle opacity
	$back-normal-opacity: 0;
	$back-pop-opacity: 0.5;
	$back-normal-scale: 0;
	$back-pop-scale: $front-pop-scale * 0.3;
	$resting-rotation: 0deg;
	$active-rotation: 179deg;

	.admin-loading-icon {
		.loading-dot {
			position: relative;
			width: $dot-radius * 2;
			height: $dot-radius * 2;
			margin: $dot-spacing / 2;
			will-change: transform;

			&:before {
				content: "";
				position: absolute;
				top: 0;
				left: 0;
				width: 100%;
				height: 100%;
				border-radius: 50%;
				background: $semi-light-stamp-color;
			}

			&:after {
				content: "";
				position: absolute;
				top: 0;
				left: 0;
				width: 100%;
				height: 100%;
				border-radius: 50%;
				border: 1px solid $semi-light-stamp-color;
			}
		}

		.dot-1 {
			animation: loading-flip-dot-1 $animation-duration infinite;

			&:before {
				animation: loading-dot-1-back-opacity $animation-duration infinite;
			}

			&:after {
				animation: loading-dot-1-front-scale $animation-duration infinite;
			}
		}

		.dot-2 {
			animation: loading-flip-dot-2 $animation-duration infinite;

			&:before {
				animation: loading-dot-2-back-opacity $animation-duration infinite;
			}

			&:after {
				animation: loading-dot-2-front-scale $animation-duration infinite;
			}
		}

		.dot-3 {
			animation: loading-flip-dot-3 $animation-duration infinite;

			&:before {
				animation: loading-dot-3-back-opacity $animation-duration infinite;
			}

			&:after {
				animation: loading-dot-3-front-scale $animation-duration infinite;
			}
		}

		.dot-4 {
			animation: loading-flip-dot-4 $animation-duration infinite;

			&:before {
				animation: loading-dot-4-back-opacity $animation-duration infinite;
			}

			&:after {
				animation: loading-dot-4-front-scale $animation-duration infinite;
			}
		}

		&.full-width {
			position: absolute;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
		}
	}

	@keyframes loading-flip-dot-1 {
		0% {
			transform-origin: $dot-half-shift 50%;
			transform: rotate($resting-rotation);
		}

		25% {
			transform-origin: $dot-half-shift 50%;
			transform: rotate($active-rotation);
		}

		25.0001% {
			transform-origin: 50% $dot-half-shift;
			transform: translateX($dot-full-shift);
		}

		50% {
			transform-origin: 50% $dot-half-shift;
			transform: translateX($dot-full-shift) rotate($active-rotation);
		}

		50.0001% {
			transform-origin: (-$dot-spacing / 2) 50%;
			transform: translate($dot-full-shift, $dot-full-shift);
		}

		75% {
			transform-origin: (-$dot-spacing / 2) 50%;
			transform: translate($dot-full-shift, $dot-full-shift) rotate($active-rotation);
		}

		75.0001% {
			transform-origin: 50% (-$dot-spacing / 2);
			transform: translateY($dot-full-shift);
		}

		100% {
			transform-origin: 50% (-$dot-spacing / 2);
			transform: translateY($dot-full-shift) rotate($active-rotation);
		}
	}

	@keyframes loading-dot-1-back-opacity {
		0%,
		25%,
		50%,
		75%,
		100% {
			transform: scale($back-normal-scale);
			opacity: $back-normal-opacity;
		}

		12.5%,
		37.5%,
		62.5%,
		87.5% {
			transform: scale($back-pop-scale);
			opacity: $back-pop-opacity;
		}
	}

	@keyframes loading-dot-1-front-scale {
		0%,
		25%,
		50%,
		75%,
		100% {
			transform: scale($front-normal-scale);
		}

		12.5%,
		37.5%,
		62.5%,
		87.5% {
			transform: scale($front-pop-scale);
		}
	}

	@keyframes loading-flip-dot-2 {
		0% {
			transform-origin: (-$dot-spacing / 2) 50%;
			transform: rotate($resting-rotation);
		}

		25%,
		75% {
			transform-origin: (-$dot-spacing / 2) 50%;
			transform: rotate($active-rotation);
		}

		75.001% {
			transform-origin: 50% $dot-half-shift;
			transform: translate(-$dot-full-shift, 0);
		}

		100% {
			transform-origin: 50% $dot-half-shift;
			transform: translate(-$dot-full-shift, 0) rotate($active-rotation);
		}
	}

	@keyframes loading-dot-2-back-opacity {
		0%,
		25%,
		75%,
		100% {
			transform: scale($back-normal-scale);
			opacity: $back-normal-opacity;
		}

		12.5%,
		87.5% {
			transform: scale($back-pop-scale);
			opacity: $back-pop-opacity;
		}
	}

	@keyframes loading-dot-2-front-scale {
		0%,
		25%,
		75%,
		100% {
			transform: scale($front-normal-scale);
		}

		12.5%,
		87.5% {
			transform: scale($front-pop-scale);
		}
	}

	@keyframes loading-flip-dot-3 {
		0%,
		50% {
			transform-origin: $dot-half-shift 50%;
			transform: rotate(0);
		}

		75%,
		100% {
			transform-origin: $dot-half-shift 50%;
			transform: rotate($active-rotation);
		}
	}

	@keyframes loading-dot-3-back-opacity {
		0%,
		50%,
		75%,
		100% {
			transform: scale($back-normal-scale);
			opacity: $back-normal-opacity;
		}

		62.5% {
			transform: scale($back-pop-scale);
			opacity: $back-pop-opacity;
		}
	}

	@keyframes loading-dot-3-front-scale {
		0%,
		50%,
		75%,
		100% {
			transform: scale($front-normal-scale);
		}

		62.5% {
			transform: scale($front-pop-scale);
		}
	}

	@keyframes loading-flip-dot-4 {
		0%,
		25% {
			transform-origin: 50% (-$dot-spacing / 2);
			transform: rotate($resting-rotation);
		}

		50%,
		100% {
			transform-origin: 50% (-$dot-spacing / 2);
			transform: rotate($active-rotation);
		}
	}

	@keyframes loading-dot-4-back-opacity {
		0%,
		25%,
		50%,
		100% {
			transform: scale($back-normal-scale);
			opacity: $back-normal-opacity;
		}

		37.5% {
			transform: scale($back-pop-scale);
			opacity: $back-pop-opacity;
		}
	}

	@keyframes loading-dot-4-front-scale {
		0%,
		25%,
		50%,
		100% {
			transform: scale($front-normal-scale);
		}

		37.5% {
			transform: scale($front-pop-scale);
		}
	}
</style>
