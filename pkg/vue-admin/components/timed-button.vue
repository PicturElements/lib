<template lang="pug">
	button.timed-button(
		@mousedown="triggerActive"
		@touchstart="triggerActive"
		@mouseup="triggerInaction"
		@touchend="triggerInaction"
		@mouseleave="triggerInaction"
		@touchleave="triggerInaction"
		@blur="triggerInaction")
		.timed-button-content-wrapper(ref="inactiveWrapper")
			.timed-button-content.inactive
				slot
		.unveil-overflow-wrapper
			.unveil-wrapper(
				:class="{ idle: !progress, running: progress % 1, done: progress == 1 }"
				:style="{ width: progress % 1 ? `${progress * 100}%` : null }")
				.timed-button-content-wrapper(
					:style="{ width: progress % 1 ? `${wrapperWidth}px` : null }"
					ref="activeWrapper")
					.timed-button-content.active
						slot
</template>

<script>
	import {
		fitNum,
		getTime,
		requestFrame
	} from "@qtxr/utils";

	export default {
		name: "TimedButton",
		data: _ => ({
			active: false,
			progress: 0,
			wrapperWidth: 0,
			startTime: 0
		}),
		methods: {
			triggerActive() {
				this.wrapperWidth = this.$refs.inactiveWrapper.getBoundingClientRect().width;
				this.initAction();
			},
			triggerInaction() {
				if (this.progress < 1)
					this.progress = 0;

				this.active = false;
			},
			initAction() {
				this.active = true;
				this.startTime = getTime();
				this.updateProgress();
			},
			updateProgress() {
				const elapsed = getTime() - this.startTime,
					progress = fitNum(elapsed / this.delay, 0, 1);

				if (progress == 1) {
					this.$emit("confirm");
					this.progress = progress;
					return;
				}

				if (!this.active) {
					this.$emit("cancel");
					return;
				}

				this.progress = progress;

				requestFrame(_ => this.updateProgress());
			}
		},
		props: {
			delay: {
				type: Number,
				default: 600
			}
		}
	};
</script>
