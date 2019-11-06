<template lang="pug">
	.input-wrapper.media.inp-media
		.media-upload.a-fill.f.c(
			:style="{ paddingTop: `${(input.targetSize.h / input.targetSize.w) * 100}%` }"
			@mousemove="move"
			@touchmove="move"
			@mouseup="leave"
			@touchend="leave"
			@mouseleave="leave"
			@touchleave="leave"
			ref="box")
			template(v-if="editPhase == 'prompt'")
				.upload-prompt.f.c.col.a-fill
					slot(name="upload-icon")
						svg.media-upload-icon(viewBox="0 0 75 55")
							path(d="M70,10H40L36.78,3.56A6.45,6.45,0,0,0,31,0H19a6.45,6.45,0,0,0-5.77,3.56L10,10H5a5,5,0,0,0-5,5V50a5,5,0,0,0,5,5H70a5,5,0,0,0,5-5V15A5,5,0,0,0,70,10ZM25,47A15,15,0,1,1,40,32,15,15,0,0,1,25,47ZM65,32a3,3,0,0,1-3,3H53a3,3,0,0,1-3-3V23a3,3,0,0,1,3-3H62a3,3,0,0,1,3,3Z")
					span.upload-prompt-message
						slot(name="upload-message") click to upload
				input.upload-inp.a-fill(
					type="file"
					:accept="input.mediaOptions.accept"
					:multiple="input.multiple"
					@change="initEdit")
			template(v-else-if="editPhase == 'loading'")
				slot(name="loading-icon")
			.edit-box.a-fill(
				v-show="editPhase == 'edit'"
				:class="[moveMode, moveMode ? 'editing' : null]")
				.edit-header.f.jc(v-if="fileData")
					span {{ fileData.dimensions.w }}&nbsp;&times;&nbsp;{{ fileData.dimensions.h }} ({{ crop.dimensions.w }}&nbsp;&times;&nbsp;{{ crop.dimensions.h }})
				img.display-image(
					:style="{ width: `${crop.dimensions.wp}%`, height: `${crop.dimensions.hp}%`, transform: crop.transform }"
					ref="img")
				.hit-target.a-fill(
					@mousedown="startImageMove"
					@touchstart="startImageMove")
				.edit-footer.f.ac
					.action.cancel.f-nshrink(@click="cancelCurrentEdit")
						.elem-icon.a-fill.back
						.elem-icon.a-fill.front
					.zoom-slider.f-grow(
						@mousedown.stop="startSliderMove"
						@touchstart.stop="startSliderMove"
						ref="slider")
						.nub(
							:style="{ left: sliderPos }"
							ref="sliderNub")
					.action.confirm.f-nshrink(@click="dispatchEdit")
						.elem-icon.a-fill.back
						.elem-icon.a-fill.front
		.queued-output-wrapper(
			v-if="input.multiple && enqueuedOutput.length"
			ref="enqueuedOutputWrapper")
			.queued-output.f
				.queued-output-item.f-nshrink(v-for="(output, idx) in enqueuedOutput")
					img(
						v-if="output.mediaType == 'image'"
						:src="output.data")
					.remove-output-item(@click="removeOutput(idx)") &times;
		canvas.edit-canv(ref="editCanv")
</template>

<script>
	import Form, { Media } from "@qtxr/form";

	import {
		round,
		requestFrame
	} from "@qtxr/utils";
	import { getCoords } from "@qtxr/evt";

	function calcFileSize(bytes) {
		if (bytes > 1e6)
			return round(bytes / 1e6, 2) + "MB";

		if (bytes > 1e3)
			return round(bytes / 1e3, 2) + "KB";
			
		return bytes + "bytes";
	}

	export default {
		name: "ImageUpload",
		data() {
			return {
				editPhase: "prompt",
				moveMode: null,
				enqueuedInput: [],
				enqueuedOutput: [],
				fileData: null,
				crop: {
					scale: {
						current: 1,
						min: 1,
						max: 1
					},
					center: {
						x: 0,
						y: 0
					},
					dimensions: {
						w: 0,
						h: 0,
						wp: 0,
						hp: 0
					},
					sampling: {
						x: 1,
						y: 1
					},
					coords: null,
					transform: ""
				},
				sliderPos: ""
			};
		},
		methods: {
			initEdit(evt) {
				const files = [],
					len = this.input.multiple ? evt.target.files.length : 1;

				for (let i = 0; i < len; i++)
					files.push(evt.target.files[i]);

				this.enqueuedInput = files;
				evt.target.value = "";
				this.nextAction();
			},
			nextAction() {
				if (this.enqueuedInput.length)
					this.nextFile();
				else
					this.setEditPhase("prompt");
			},
			nextFile() {
				this.setEditPhase("loading");

				this.fileData = {
					size: 0,
					sizeStr: "",
					name: null,
					data: "",
					mediaType: null,
					contentType: null,
					aspectRatio: 0,
					dimensions: {
						w: 0,
						h: 0
					}
				};

				const fd = this.fileData,
					file = this.enqueuedInput.shift();

				fd.name = file.name;
				fd.size = file.size;
				fd.sizeStr = calcFileSize(file.size);
				fd.contentType = file.type;
				fd.mediaType = file.type.split("/")[0];

				const reader = new FileReader();

				reader.onload = _ => {
					const data = reader.result,
						img = this.$refs.img;
					
					fd.data = data;

					img.onload = _ => {
						fd.dimensions.w = img.naturalWidth;
						fd.dimensions.h = img.naturalHeight;
						fd.aspectRatio = img.naturalHeight / img.naturalWidth;

						this.startNextEdit();
					};

					img.onerror = _ => {
						// alert.open("error", "Failed to create image");
						this.setEditPhase("prompt");
					};

					img.src = data;
				};

				reader.onerror = _ => {
					// alert.open("error", "Failed to read file");
					this.setEditPhase("prompt");
				};

				reader.readAsDataURL(file);
			},
			startNextEdit() {
				const fd = this.fileData,
					crop = this.crop,
					ts = this.input.targetSize;

				const w = fd.dimensions.w,
					h = fd.dimensions.h,
					srcRatio = w / h,
					targRatio = ts.w / ts.h;

				if (this.enforceSize && (w < ts.w || h < ts.h)) {
					// alert.open("error", `Image too small: upload an image that's minimum ${ts.w}x${ts.h}px in size`, 6000);
					return this.setEditPhase("prompt");
				}

				let minScale = null;

				if (srcRatio > targRatio)
					minScale = ts.h / h;
				else
					minScale = ts.w / w;

				crop.scale.min = minScale;
				crop.scale.current = minScale;

				const bcr = this.$refs.box.getBoundingClientRect();

				crop.sampling = {
					x: bcr.width / ts.w,
					y: bcr.height / ts.h
				};

				crop.dimensions.wp = w / ts.w * 100;
				crop.dimensions.hp = h / ts.h * 100;
					
				this.setImagePosition(w / 2, h / 2);
				this.setSliderPosition(0);
				this.setEditPhase("edit");
			},
			setEditPhase(phase) {
				this.editPhase = phase;
			},
			move(evt) {
				switch (this.moveMode) {
					case "slide":
						this.moveSlider(evt);
						evt.preventDefault();
						break;
					case "move":
						this.moveImage(evt);
						evt.preventDefault();
						break;
				}
			},
			startSliderMove(evt) {
				this.moveMode = "slide";
				this.moveSlider(evt);
			},
			moveSlider(evt) {
				const coords = getCoords(evt),
					scale = this.crop.scale,
					bcr = this.$refs.slider.getBoundingClientRect(),
					perc = Math.max(Math.min((coords.x - bcr.left) / bcr.width, 1), 0);

				scale.current = scale.min + (scale.max - scale.min) * perc;

				this.setSliderPosition(perc);
				this.setImagePosition();
			},
			setSliderPosition(perc) {
				this.sliderPos = (Math.max(Math.min(Number(perc) || 0, 1), 0) * 100) + "%";
			},
			startImageMove(evt) {
				this.moveMode = "move";
			},
			moveImage(evt) {
				const crop = this.crop,
					prevCoords = crop.coords,
					sampling = crop.sampling,
					currentScale = crop.scale.current,
					coords = getCoords(evt);

				if (prevCoords) {
					this.setImagePosition(
						crop.center.x + ((prevCoords.x - coords.x) / (currentScale * sampling.x)),
						crop.center.y + ((prevCoords.y - coords.y) / (currentScale * sampling.y))
					);
				}

				crop.coords = coords;
			},
			setImagePosition(x, y) {
				const crop = this.crop,
					currentScale = crop.scale.current,
					dim = this.fileData.dimensions,
					ts = this.input.targetSize,
					w = ts.w / currentScale,
					h = ts.h / currentScale;

				if (typeof x != "number" || typeof y != "number") {
					x = crop.center.x;
					y = crop.center.y;
				}

				crop.center.x = Math.max(Math.min(x, dim.w - w / 2), w / 2);
				crop.center.y = Math.max(Math.min(y, dim.h - h / 2), h / 2);

				crop.dimensions.w = Math.round(w);
				crop.dimensions.h = Math.round(h);

				crop.transform = `scale(${currentScale}) translate(${crop.center.x / dim.w * -100}%, ${crop.center.y / dim.h * -100}%)`;
			},
			leave() {
				this.moveMode = null;
				this.crop.coords = null;
			},
			cancelCurrentEdit() {
				this.nextAction();
			},
			dispatchEdit() {
				this.setEditPhase("loading");

				const crop = this.crop,
					currentScale = crop.scale.current,
					fd = this.fileData,
					dim = fd.dimensions,
					ts = this.input.targetSize,
					w = ts.w / currentScale,
					h = ts.h / currentScale,
					x = crop.center.x - w / 2,
					y = crop.center.y - h / 2,
					canv = this.$refs.editCanv,
					ctx = canv.getContext("2d");

				canv.width = ts.w;
				canv.height = ts.h;

				requestFrame(_ => {
					ctx.drawImage(this.$refs.img, x, y, w, h, 0, 0, ts.w, ts.h);
					fd.data = canv.toDataURL(this.imageType, this.mediaOptions);
					this.enqueuedOutput.push(fd);

					const wrapper = this.$refs.enqueuedOutputWrapper;
					if (wrapper)
						requestFrame(_ => wrapper.scrollLeft = 10000);

					this.nextAction();
				});
				
				/*this.bubbleChange({
					type: "upload:crop",
					data: 
				});*/
			},
			removeOutput(idx) {
				this.enqueuedOutput.splice(idx, 1);
			},
			res(val) {
				if (typeof val == "function")
					return val.call(this, this.form, this.input);

				return val;
			},
			isMobile() {
				const mobileQuery = this.mobileQuery || this.meta.mobileQuery || "(max-aspect-ratio: 1/1) and (max-width: 700px)";
				return matchMedia(mobileQuery).matches;
			}
		},
		components: {},
		props: {
			input: Media,
			mobileQuery: String,
			meta: {
				type: Object,
				default: _ => ({})
			}
		}
	};
</script>

<style lang="scss">
	/* @use "../assets/scss/theme.scss" as *; */
	@use "@qtxr/scss-utils" as *;

	$slider-width: 6px;
	$icon-width: 4px;
	$icon-shadow: 0 2px 3px rgba(0, 0, 0, 0.2);
	$shade-color: black;
	$feature-color: white;
	$output-preview-spacing: 10px;
	$highlight: #1b66bf;
	$raster-dark: #333;
	$raster-light: #222;
	$output-preview-height: 100px;
	$output-preview-border-radius: 2px;

	.inp-media {
		position: relative;
		width: 200px;
		@include raster($raster-light, $raster-dark);

		.a-fill {
			position: absolute;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
		}

		.media-upload {
			position: relative;
			width: 100%;
			height: 100%;
		}

		.upload-prompt {
			.media-upload-icon {
				width: 50px;
				fill: $feature-color;
			}

			.upload-prompt-message {
				margin: 10px 0 0;
				font-size: 85%;
				color: $feature-color;
			}
		}

		.upload-inp {
			opacity: 0.01;
			cursor: pointer;
		}

		.edit-box {
			user-select: none;
			cursor: grab;
			overflow: hidden;

			&.move {
				cursor: grabbing;
			}

			&.slide {
				cursor: pointer;
			}

			.edit-header {
				position: absolute;
				top: 0;
				left: 0;
				width: 100%;
				height: 28px;
				line-height: 26px;
				font-family: Consolas, Courier, monospace;
				color: $feature-color;
				padding: 0 8px;
				box-sizing: border-box;
				user-select: none;
				transition: transform 300ms;
				transition-delay: 400ms;
				z-index: 100;

				&:before {
					content: "";
					position: absolute;
					top: 0;
					left: 0;
					width: 100%;
					height: 150%;
					background: linear-gradient(to bottom, rgba($shade-color, 0.7) 0%, rgba($shade-color, 0) 100%);
					z-index: -1;
				}

				span {
					font-size: 85%;

					+ span {
						margin-left: 10px;
					}
				}

				.close {
					position: absolute;
					top: 0;
					right: 0;
					width: 28px;
					height: 28px;
					line-height: 29px;
					text-align: center;
					font-size: 150%;
					cursor: pointer;
				}
			}

			&.move .edit-header {
				transform: translateY(-100%);
				transition-delay: 0ms;
			}

			.display-image {
				position: absolute;
				top: 50%;
				left: 50%;
				transform-origin: 0 0;
			}

			.hit-target {
				z-index: 90;
			}

			.edit-footer {
				position: absolute;
				bottom: 0;
				left: 0;
				width: 100%;
				padding: 0 14px 14px;
				box-sizing: border-box;
				transition: transform 300ms;
				transition-delay: 400ms;
				z-index: 100;

				&:before {
					content: "";
					position: absolute;
					bottom: 0;
					left: 0;
					width: 100%;
					height: 150%;
					background: linear-gradient(to top, rgba($shade-color, 0.7) 0%, rgba($shade-color, 0) 100%);
					z-index: -1;
				}
			}

			.action {
				position: relative;
				width: 24px;
				height: 24px;
				border-radius: 50%;
				cursor: pointer;

				.elem-icon {
					transform: rotate(45deg);

					&:before,
					&:after {
						content: "";
						position: absolute;
						top: 0;
						left: 0;
						width: $icon-width;
						height: $icon-width;
						background: $feature-color;
						border-radius: $icon-width / 2;
					}

					&.back {
						&:before,
						&:after {
							box-shadow: $icon-shadow;
						}
					}
				}

				&.cancel .elem-icon {
					&:before {
						width: 100%;
						top: 50%;
						margin-top: -$icon-width / 2;
					}

					&:after {
						height: 100%;
						left: 50%;
						margin-left: -$icon-width / 2;
					}
				}

				&.confirm .elem-icon {
					&:before {
						height: 90%;
						left: 60%;
						top: 0;
						margin-left: -$icon-width / 2;
					}

					&:after {
						width: 50%;
						left: 15%;
						top: 90%;
						margin-top: -$icon-width;
					}
				}
			}

			&.move .edit-footer {
				transform: translateY(100%);
				transition-delay: 0ms;
			}

			.zoom-slider {
				position: relative;
				height: $slider-width;
				margin: 0 20px;
				background: $feature-color;
				border-radius: $slider-width / 2;
				box-shadow: $icon-shadow;
				cursor: pointer;

				.nub {
					position: absolute;
					top: 50%;
					left: 0;
					width: 20px;
					height: 20px;
					margin: -10px;
					background: $feature-color;
					box-sizing: border-box;
					border: 6px solid $highlight;
					box-shadow: inherit;
					border-radius: 50%;
				}
			}
		}

		.queued-output-wrapper {
			overflow: auto;
			padding: $output-preview-spacing;
			background: rgba($feature-color, 0.07);
		}

		.queued-output {
			height: $output-preview-height;
			border-radius: $output-preview-border-radius;

			&:after {
				content: "";
				position: relative;
				width: $output-preview-spacing;
				height: 100%;
				flex-shrink: 0;
			}
			
			.queued-output-item {
				position: relative;
				height: 100%;
				box-sizing: content-box;
				border-radius: $output-preview-border-radius;
				box-shadow: 0 0 0 2px $feature-color;
				overflow: hidden;

				&:before {
					content: "";
					position: absolute;
					top: 0;
					left: 0;
					width: 100%;
					height: 25%;
					background: linear-gradient(to bottom, rgba($shade-color, 0.6) 0%, rgba($shade-color, 0) 100%);
					z-index: 1;
				}

				+ .queued-output-item {
					margin-left: $output-preview-spacing;
				}

				img {
					height: 100%;
				}

				.remove-output-item {
					position: absolute;
					top: 0;
					right: 0;
					z-index: 100;
					color: $feature-color;
					font-weight: bold;
					font-size: 20px;
					text-shadow: $icon-shadow;
					line-height: 0.6;
					padding: 5px;
					cursor: pointer;
				}
			}
		}

		.edit-canv {
			position: absolute;
			top: 0;
			left: 0;
			opacity: 0;
			z-index: -1;
		}

		@include mobile {
			.edit-box {
				.edit-header {
					font-size: 80%;
					flex-wrap: wrap;
					min-height: 28px;
					height: auto;
					line-height: 1.5;
					padding: 8px;
				}
			}
		}
	}
</style>
