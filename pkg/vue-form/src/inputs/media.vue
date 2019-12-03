<template lang="pug">
	.input-wrapper.media.inp-media
		.media-upload.a-fill(
			:class="[ validationState, editPhase != 'prompt' ? 'in-use' : null ]"
			:style="{ paddingTop: `${(input.targetSize.h / input.targetSize.w) * 100}%` }"
			@mousemove="move"
			@touchmove="move"
			@mouseup="leave"
			@touchend="leave"
			@mouseleave="leave"
			@touchleave="leave"
			ref="box")
			template(v-if="editPhase == 'prompt'")
				.edited-result.a-fill(v-if="!input.multiple && enqueuedOutput.length")
					img.edited-result-media.a-fill(
						v-if="enqueuedOutput[0].mediaType == 'image'"
						:src="enqueuedOutput[0].data")
					video.edited-result-media.result-video(
						v-else-if="enqueuedOutput[0].mediaType == 'video'"
						:src="enqueuedOutput[0].data")
				.upload-prompt.a-fill
					slot(name="upload-icon")
						svg.media-upload-icon(viewBox="-5 -5 85 65")
							path(d="M70,10H40L36.78,3.56A6.45,6.45,0,0,0,31,0H19a6.45,6.45,0,0,0-5.77,3.56L10,10H5a5,5,0,0,0-5,5V50a5,5,0,0,0,5,5H70a5,5,0,0,0,5-5V15A5,5,0,0,0,70,10ZM25,47A15,15,0,1,1,40,32,15,15,0,0,1,25,47ZM65,32a3,3,0,0,1-3,3H53a3,3,0,0,1-3-3V23a3,3,0,0,1,3-3H62a3,3,0,0,1,3,3Z")
					span.upload-prompt-message
						slot(
							v-if="input.ignoreSize"
							name="upload-message") click to upload
						slot(
							v-else
							name="upload-message")
							| {{ input.targetSize.w }} &times; {{ input.targetSize.h }}
							br
							| click to upload
				input.upload-inp.a-fill(
					type="file"
					:accept="input.mediaOptions.accept"
					:multiple="input.multiple"
					@change="initEdit")
			template(v-else-if="editPhase == 'loading'")
				slot(name="loading-icon")
			.edit-box.a-fill(
				v-show="editPhase == 'edit'"
				:class="[moveMode, moveMode ? 'editing' : null, mediaType ? `media-${mediaType}` : null]")
				template(v-if="mediaType == 'image'")
					.edit-header
						span {{ fileData.dimensions.w }}&nbsp;&times;&nbsp;{{ fileData.dimensions.h }} ({{ crop.dimensions.w }}&nbsp;&times;&nbsp;{{ crop.dimensions.h }})
					img.display-image(
						:style="input.ignoreSize ? fileData.style : { width: `${crop.dimensions.wp}%`, height: `${crop.dimensions.hp}%`, transform: crop.transform }"
						ref="img")
					.hit-target.a-fill(
						@mousedown="startImageMove"
						@touchstart="startImageMove")
				template(v-else-if="mediaType == 'video'")
					.edit-header
						span {{ fileData.dimensions.w }}&nbsp;&times;&nbsp;{{ fileData.dimensions.h }} {{ getTimeStr(fileData.currentTime) }}/{{ getTimeStr(fileData.duration) }}
					video.display-video(
						:style="fileData.style"
						ref="video")
					.hit-target.a-fill(@click="toggleVideoPlay")
				template(v-else-if="mediaType == 'error'")
					.a-fill.error-msg
						slot(name="error-message" v-bind="error") {{ error.message }}
				.edit-footer
					.action.cancel(@click="cancelCurrentEdit")
						.elem-icon.a-fill.back
						.elem-icon.a-fill.front
					.zoom-slider(
						:style="{ visibility: mediaType == 'image' && input.ignoreSize ? 'hidden' : null }"
						@mousedown.stop="startSliderMove"
						@touchstart.stop="startSliderMove"
						ref="slider")
						.nub(
							:style="{ left: sliderPos }"
							ref="sliderNub")
					.action.confirm(@click="dispatchEdit")
						.elem-icon.a-fill.back
						.elem-icon.a-fill.front
		.queued-output-wrapper(
			v-if="input.multiple && enqueuedOutput.length"
			ref="enqueuedOutputWrapper")
			.queued-output
				.queued-output-item(v-for="(output, idx) in enqueuedOutput")
					img(
						v-if="output.mediaType == 'image'"
						:src="output.data"
						:key="idx")
					video(
						v-else-if="output.mediaType == 'video'"
						:src="output.data"
						:key="idx")
					.remove-output-item(@click="removeOutput(idx)") &times;
		.validation-msg(:class="validationMsg ? 'active' : null") {{ validationMsg }}
		canvas.edit-canv(ref="editCanv")
</template>

<script>
	import Form, { Media } from "@qtxr/form";

	import {
		round,
		padStart,
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
		name: "Media",
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
				uploadIdx: 0,
				sliderPos: "",
				error: null,
				validationMsg: null,
				validationState: "ok"
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
					},
					style: null,
					index: this.uploadIdx++
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
					fd.data = reader.result;

					switch (fd.mediaType) {
						case "image":
							this.handleImageInit(fd.data);
							break;
						case "video":
							this.handleVideoInit(fd.data);
							break;
					}
				};

				reader.onerror = _ => {
					this.setError({
						type: "file-load-fail",
						message: `Failed to load file '${fd.name}'`
					});
				};

				reader.readAsDataURL(file);
			},
			handleImageInit(data) {
				const fd = this.fileData,
					img = this.$refs.img;

				if (!this.input.multiple)
					this.enqueuedOutput = [];

				img.onload = _ => {
					img.onload = null;
					fd.dimensions.w = img.naturalWidth;
					fd.dimensions.h = img.naturalHeight;
					this.setAspectRatio(fd);
					this.startImageEdit();
				};

				img.onerror = _ => {
					img.onerror = null;
					this.setError({
						type: "image-load-fail",
						message: `Failed to load image '${fd.name}'`
					});
				};

				img.src = fd.data;
			},
			handleVideoInit(data) {
				const fd = this.fileData,
					video = this.$refs.video;

				video.onloadedmetadata = _ => {
					video.onloadedmetadata = null;
					fd.dimensions.w = video.videoWidth;
					fd.dimensions.h = video.videoHeight;
					fd.duration = video.duration;
					fd.currentTime = 0;
					this.setAspectRatio(fd);
					this.startVideoEdit();
				};

				video.ontimeupdate = _ => {
					fd.currentTime = video.currentTime;
					this.setSliderPosition(video.currentTime / video.duration);
				};
				
				video.onerror = _ => {
					video.onerror = null;
					this.setError({
						type: "video-load-fail",
						message: `Failed to load video '${fd.name}'`
					});
				};

				video.src = fd.data;
			},
			setAspectRatio(fd) {
				const ts = this.input.targetSize,
					targetAspectRatio = ts.h / ts.w;

				fd.aspectRatio = fd.dimensions.h / fd.dimensions.w;

				if (fd.aspectRatio > targetAspectRatio) {
					fd.style = {
						position: "absolute",
						top: "0",
						left: "50%",
						height: "100%",
						transform: "translateX(-50%)"
					};
				} else {
					fd.style = {
						position: "absolute",
						top: "50%",
						left: "0",
						width: "100%",
						transform: "translateY(-50%)"
					};
				}
			},
			startImageEdit() {
				if (this.input.ignoreSize) {
					this.setEditPhase("edit");
					return;
				}

				const fd = this.fileData,
					crop = this.crop,
					ts = this.input.targetSize;

				const w = fd.dimensions.w,
					h = fd.dimensions.h,
					srcRatio = w / h,
					targRatio = ts.w / ts.h;

				if (this.input.enforceSize && (w < ts.w || h < ts.h)) {
					return this.setError({
						type: "image-too-small",
						message: `Image too small: upload an image that's minimum ${ts.w} × ${ts.h}px in size`
					});
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
			startVideoEdit() {
				const fd = this.fileData,
					ts = this.input.targetSize;

				const w = fd.dimensions.w,
					h = fd.dimensions.h;

				if (this.input.enforceSize && (w < ts.w || h < ts.h)) {
					return this.setError({
						type: "video-too-small",
						message: `Video too small: upload a video that's minimum ${ts.w} × ${ts.h}px in size`
					});
				}

				this.setEditPhase("edit");
			},
			setEditPhase(phase) {
				this.editPhase = phase;
			},
			setError(error) {
				this.fileData.mediaType = "error";
				this.error = error;
				this.setEditPhase("edit");
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
				const fd = this.fileData,
					coords = getCoords(evt),
					bcr = this.$refs.slider.getBoundingClientRect(),
					perc = Math.max(Math.min((coords.x - bcr.left) / bcr.width, 1), 0);

				this.setSliderPosition(perc);

				switch (this.mediaType) {
					case "image": {
						const scale = this.crop.scale;
						scale.current = scale.min + (scale.max - scale.min) * perc;
						this.setImagePosition();
						break;
					}
					case "video":
						this.$refs.video.currentTime = perc * fd.duration;
						break;
				}
			},
			setSliderPosition(perc) {
				this.sliderPos = (Math.max(Math.min(Number(perc) || 0, 1), 0) * 100) + "%";
			},
			startImageMove(evt) {
				this.moveMode = "move";
			},
			toggleVideoPlay() {
				const video = this.$refs.video;

				if (video.paused)
					video.play();
				else
					video.pause();
			},
			getTimeStr(time) {
				let out = "";

				if (time > 3600)
					out = `${padStart(Math.floor(time / 3600), 2, "0")}:`;

				out += `${padStart(Math.floor(time / 60) % 60, 2, "0")}:${padStart(Math.floor(time % 60), 2, "0")}`;

				return out;
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
				if (!this.input.multiple) {
					this.enqueuedOutput = [];
					this.dispatchChange();
				}

				this.nextAction();
			},
			dispatchEdit() {
				this.setEditPhase("loading");
				const fd = this.fileData;

				switch (fd.mediaType) {
					case "image":
						this.dispatchImage(fd);
						break;
					case "video":
						this.dispatchVideo(fd);
						break;
					case "error":
						this.dispatchChange();
						this.nextAction();
						break;
				}
			},
			dispatchImage(fd) {
				const dispatch = (dataUrl, w, h) => {
					this.addData({
						data: dataUrl,
						contentType: fd.contentType,
						mediaType: fd.mediaType,
						source: {
							width: fd.dimensions.w,
							height: fd.dimensions.h,
							aspectRatio: fd.aspectRatio,
							size: fd.size,
							name: fd.name
						},
						width: w,
						height: h,
						aspectRatio: h / w
					});

					const wrapper = this.$refs.enqueuedOutputWrapper;
					if (wrapper)
						requestFrame(_ => wrapper.scrollLeft = 10000);

					this.dispatchChange();
					this.nextAction();
				};

				if (this.input.ignoreSize)
					return dispatch(fd.data, fd.dimensions.w, fd.dimensions.h);

				const crop = this.crop,
					currentScale = crop.scale.current,
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

					dispatch(
						canv.toDataURL(
							this.input.mediaOptions.type,
							this.input.mediaOptions.quality
						),
						w,
						h
					);
				});
			},
			dispatchVideo(fd) {
				this.addData({
					data: fd.data,
					contentType: fd.contentType,
					mediaType: fd.mediaType,
					source: {
						width: fd.dimensions.w,
						height: fd.dimensions.h,
						aspectRatio: fd.aspectRatio,
						size: fd.size,
						name: fd.name
					},
					width: fd.dimensions.w,
					height: fd.dimensions.h,
					aspectRatio: fd.aspectRatio
				});

				this.dispatchChange();
				this.nextAction();
			},
			addData(data) {
				if (this.input.multiple)
					this.enqueuedOutput.push(data);
				else
					this.enqueuedOutput = [data];
			},
			removeOutput(idx) {
				this.enqueuedOutput.splice(idx, 1);
				this.dispatchChange();
			},
			dispatchChange() {
				if (this.input.multiple) {
					const val = [];

					for (let i = 0, l = this.enqueuedOutput.length; i < l; i++)
						val.push(this.enqueuedOutput[i]);

					Form.trigger(this.input, val);
				} else
					Form.trigger(this.input, this.enqueuedOutput[0]);
			},
			updateOutputQueue() {
				if (this.input.multiple)
					this.enqueuedOutput = this.input.value || [];
				else
					this.enqueuedOutput = this.input.value ? [this.input.value] : [];
			},
			res(val, ...args) {
				if (typeof val == "function")
					return val.call(this, this.input, ...args);

				return val;
			},
			isMobile() {
				const mobileQuery = this.mobileQuery || this.meta.mobileQuery || "(max-aspect-ratio: 1/1) and (max-width: 700px)";
				return matchMedia(mobileQuery).matches;
			}
		},
		computed: {
			mediaType() {
				return this.fileData && this.fileData.mediaType;
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
		},
		watch: {
			"input.value"() {
				this.updateOutputQueue();
			}
		},
		beforeMount() {
			this.updateOutputQueue();

			this.input.hook("update", inp => {
				this.validationState = inp.validationState;
				this.validationMsg = inp.validationMsg || this.validationMsg;
			});
		},
	};
</script>
