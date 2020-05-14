<template lang="pug">
	.drop-wrapper(
		:class="[ expanded ? 'open' : null, dropdownDirection ]"
		ref="wrapper")
		button.mobi-focus(
			:disabled="disabled"
			:tabindex="expanded ? -1 : 0"
			@click="expand")
		textarea.focus-probe(
			:disabled="disabled"
			:tabindex="expanded ? -1 : 0"
			@focus="focus"
			@blur="blur"
			@click="expand"
			ref="focusProbe")
		.collapse-target(@click="collapse")
		.drop-expando-box(ref="expando")
			slot(
				name="expando-box"
				v-bind="runtime")
		.drop-dropdown(
			:style="dropdownStyle"
			@mousedown="handleAdaptiveFocusDown"
			@wheel="handleWheel"
			@focusout="handleFocusOut"
			ref="dropdown")
			slot(name="content" v-bind="runtime")
				.drop-dropdown-scroll
					slot(v-bind="runtime")
</template>

<script>
	import {
		equals,
		isObject,
		concatMut,
		hasAncestor,
		resolveArgs,
		requestFrame
	} from "@qtxr/utils";
	import EVT from "@qtxr/evt";
	import utilMixin from "../util-mixin";

	const WEIGHTED_HANDLER_ARGS = [
		{
			name: "target",
			type: evtOrTarget => evtOrTarget instanceof EventTarget,
			resolve: evtOrTarget => {
				if (evtOrTarget instanceof Event)
					return evtOrTarget.target;

				if (evtOrTarget instanceof EventTarget)
					return evtOrTarget;
				
				return null;
			}
		},
		{ name: "weight", type: "number", default: 0 }
	];

	export default {
		name: "Drop",
		mixins: [utilMixin],
		data() {
			return {
				expanded: false,
				dropdownDirection: null,
				dropdownStyle: null,
				updateLoopInitialized: false,
				globalKeyListener: null,
				globalVisibilityListener: null,
				focusData: {
					blurWeight: 0,
					focusWeight: 0,
					forceBlur: false,
					adaptiveBlurTarget: null,
					target: null,
					timeout: -1
				},
				assets: {
					expand: _ => this.expand(),
					collapse: (evtOrTarget, weight = 1) => this.collapse(evtOrTarget, weight),
					focus: (evtOrTarget, weight = 1) => this.focus(evtOrTarget, weight),
					adaptiveFocus: (evtOrTarget, weight = 1) => this.focus(evtOrTarget, weight),
					blur: (evtOrTarget, weight = 1) => this.blur(evtOrTarget, weight),
					adaptiveBlur: (evtOrTarget, weight = 1) => this.adaptiveBlur(evtOrTarget, weight),
					hasNeutralTarget: _ => this.isIgnoredNode(document.activeElement)
				}
			};
		},
		methods: {
			expand() {
				this.clearTimeout();

				if (this.expanded)
					return;

				this.expanded = true;
				this.initUpdateLoop();
				this.$emit("expand", this.runtime);
				requestFrame(_ => this.focusData.focusWeight = 0);
			},
			collapse(...args) {
				this.clearTimeout();

				if (!this.expanded)
					return;

				const { weight } = resolveArgs(args, WEIGHTED_HANDLER_ARGS);

				if (weight)
					this.blur(...args);

				this.expanded = false;
				this.dropdownDirection = null;
				this.focusData.target = null;
				this.focusData.focusWeight = 0;
				this.setTimeout(_ => this.focusData.blurWeight = 0, 50);
				this.$emit("collapse", this.runtime);
			},
			focus(...args) {
				const {
					target,
					weight
				} = resolveArgs(args, WEIGHTED_HANDLER_ARGS);

				if (!target || !this.isIgnoredNode(target))
					this.focusData.target = target;

				if (weight >= this.focusData.blurWeight) {
					this.clearTimeout();
					this.focusData.focusWeight = weight;
					this.applyFocus();
					this.expand();
				}
			},
			blur(...args) {
				const { weight } = resolveArgs(args, WEIGHTED_HANDLER_ARGS);

				if (weight >= this.focusData.focusWeight) {
					this.focusData.blurWeight = weight;
					this.setTimeout(_ => this.handleRequestedBlur(weight));
				}
			},
			adaptiveBlur(...args) {
				const {
					target,
					weight
				} = resolveArgs(args, WEIGHTED_HANDLER_ARGS);

				if (target && this.nodeIsFocusable(target)) {
					this.blur(...args);
					this.focusData.target = target;
				} else
					this.applyFocus();
			},
			handleRequestedBlur() {
				const nodeInScope = hasAncestor(document.activeElement, this.$refs.dropdown);

				if (this.focusData.focusWeight >= this.focusData.blurWeight && this.adaptive && nodeInScope)
					this.handleAdaptiveFocusTarget(document.activeElement);
				else {
					if (this.focusData.blurWeight > this.focusData.focusWeight || !nodeInScope)
						this.collapse();
					else if (nodeInScope)
						this.applyFocus();
				}
			},
			handleAdaptiveFocusDown(evt) {
				if (!this.adaptive || this.focusData.forceBlur)
					return;

				if (this.adaptive && hasAncestor(evt.target, this.$refs.dropdown)) {
					this.focusData.focusWeight = this.focusData.blurWeight + 1;
					requestFrame(_ => {
						this.focusData.focusWeight = 0;
						this.handleAdaptiveFocusTarget(evt.target);
					});
				}
			},
			handleAdaptiveFocusTarget(target) {
				const ae = document.activeElement,
					dropdown = this.$refs.dropdown;

				if (hasAncestor(ae, dropdown))
					this.setAdaptiveBlurTarget(ae);
				else
					this.applyFocus();
			},
			handleWheel(evt) {
				const targets = this.getScrollTargets(),
					dX = evt.deltaX,
					dY = evt.deltaY;

				for (let i = 0, l = targets.length; i < l; i++) {
					const wrapper = targets[i],
						node = wrapper.node;

					if (!hasAncestor(evt.target, node))
						continue;

					if (wrapper.detectVisibility && !this.nodeIsVisible(node))
						continue;

					// Else, a valid scrollable node is found, and a decision is made
					// to scroll in either of the following ways:
					// block		- all scrolling is disabled
					// synthetic	- native scrolling is disabled and the node is scrolled
					//				  via explicit scroll position setting
					// native		- scrolling is deferred to native

					let restrictX = false,
						restrictY = false;

					if (dX < 0 && !node.scrollLeft)
						restrictX = true;
					if (dY < 0 && !node.scrollTop)
						restrictY = true;

					if (dX > 0 && (node.scrollWidth - node.scrollLeft - node.offsetWidth) <= wrapper.xTolerance)
						restrictX = true;
					if (dY > 0 && (node.scrollHeight - node.scrollTop - node.offsetHeight) <= wrapper.yTolerance)
						restrictY = true;

					if ((restrictX && restrictY) || (restrictY && !dX) || (restrictX && !dY))
						evt.preventDefault();
					else if (restrictX || restrictY) {
						evt.preventDefault();

						if (restrictX)
							node.scrollTop += dY;
						else if (restrictY)
							node.scrollLeft += dX;
					}

					break;
				}
			},
			handleFocusOut(evt) {
				if (!this.adaptive || !this.focusData.adaptiveBlurTarget)
					return;

				const node = this.focusData.adaptiveBlurTarget;
				this.focusData.adaptiveBlurTarget = null;

				// If the blurred node is focusable, it means that it's been
				// clicked off. If it's not focusable, it's been blurred by some
				// external action, which implies that collapse shouldn't occur
				if (this.focusData.blurWeight > this.focusData.focusWeight)
					this.collapse();
				else if (this.nodeIsFocusable(node)) {
					this.blur(evt);
					this.focusData.target = node;
				} else {
					this.focusData.focusWeight = this.focusData.blurWeight + 1;
					this.applyFocus();
				}
			},
			setAdaptiveBlurTarget(node) {
				this.focusData.target = node;
				this.focusData.adaptiveBlurTarget = node;
			},
			applyFocus(node) {
				requestFrame(_ => {
					node = node || this.focusData.target;

					if (!node || !this.nodeIsFocusable(node))
						node = this.getProbeNode();

					node.focus();

					if (node != document.activeElement) {
						node = this.getProbeNode();
						node.focus();
					}
					
					this.focusData.target = node;
					this.focusData.focusWeight = 0;

					if (this.adaptive && !this.isIgnoredNode(node))
						this.setAdaptiveBlurTarget(node);
				});
			},
			isIgnoredNode(node) {
				return node == this.$refs.focusProbe;
			},
			getProbeNode() {
				return this.$refs.focusProbe;
			},
			probeNodeIsFocused() {
				return this.getProbeNode() == document.activeElement;
			},
			setTimeout(callback, time = 20) {
				this.clearTimeout();
				this.focusData.timeout = setTimeout(callback, time);
			},
			clearTimeout() {
				clearTimeout(this.focusData.timeout);
			},
			initUpdateLoop() {
				if (!this.updateLoopInitialized) {
					this.updateLoopInitialized = true;
					this.updateDropdown();
				}
			},
			updateDropdown() {
				if (!this.expanded || !this.$refs.dropdown || this.isMobile()) {
					this.dropdownStyle = null;
					this.updateLoopInitialized = false;
					return;
				}

				const style = getComputedStyle(this.$refs.dropdown),
					ebcr = this.$refs.expando.getBoundingClientRect(),
					dbcr = this.$refs.dropdown.getBoundingClientRect(),
					bTop = parseFloat(style.borderTopWidth),
					bLeft = parseFloat(style.borderLeftWidth),
					bRight = parseFloat(style.borderRightWidth),
					bBottom = parseFloat(style.borderBottomWidth),
					brTopLeft = parseFloat(style.borderTopLeftRadius),
					brTopRight = parseFloat(style.borderTopRightRadius),
					brBottomLeft = parseFloat(style.borderBottomLeftRadius),
					brBottomRight = parseFloat(style.borderBottomRightRadius),
					bottomAvailable = window.innerHeight - (ebcr.top + ebcr.height) - this.gap,
					topAvailable = ebcr.top - this.gap,
					placeBottom = bottomAvailable > (topAvailable * this.bias) || dbcr.height < bottomAvailable - 100,
					maxHeight = placeBottom ? bottomAvailable : topAvailable,
					flushLeft = ebcr.left + dbcr.width < window.innerWidth - this.gap,
					leftShift = flushLeft ?
						(this.flushDropdown ? bLeft : 0) :
						ebcr.left - (window.innerWidth - this.gap - dbcr.width),
					left = ebcr.left - leftShift,
					rightShift = dbcr.width - ebcr.width - leftShift;

				const stl = {
					position: "fixed",
					width: this.flushWidth ? `${ebcr.width}px` : null,
					top: placeBottom ? `${ebcr.top + ebcr.height - bTop * (this.flushDropdown ? 2 : 1)}px` : null,
					bottom: placeBottom ? null : `${window.innerHeight - ebcr.top - bBottom * (this.flushDropdown ? 2 : 1)}px`,
					left: `${left - Math.min(rightShift, 0)}px`,
					minWidth: `${ebcr.width}px`,
					maxHeight: `${maxHeight}px`
				};
					
				if (placeBottom) {
					stl.borderTopLeftRadius = `${Math.min(brBottomLeft, leftShift)}px`;
					stl.borderTopRightRadius = `${Math.min(brBottomRight, Math.max(rightShift, 0))}px`;
				} else {
					stl.borderBottomLeftRadius = `${Math.min(brTopLeft, leftShift)}px`;
					stl.borderBottomRightRadius = `${Math.min(brTopRight, Math.max(rightShift, 0))}px`;
				}

				if (!equals(stl, this.dropdownStyle)) {
					this.dropdownStyle = stl;
					this.dropdownDirection = placeBottom ? "place-bottom" : "place-top";
				}

				requestFrame(_ => this.updateDropdown());
			},
			resolveTarget(evtOrTarget) {
				if (evtOrTarget instanceof Event)
					return evtOrTarget.target;

				if (evtOrTarget instanceof EventTarget)
					return evtOrTarget;
				
				return null;
			},
			nodeIsFocusable(node) {
				if (node.isConnected === false)
					return false;

				if (!hasAncestor(node, this.$refs.dropdown))
					return false;

				if (node.disabled === true)
					return false;

				return this.nodeIsVisible(node);
			},
			nodeIsVisible(node) {
				if (node.offsetParent === null)
					return false;

				const style = window.getComputedStyle(node);
				if (style.display == "none" || style.visibility == "hidden")
					return false;

				return true;
			},
			getScrollTargets() {
				if (!this.scrollTarget && !this.scrollTargets)
					return [];

				const wrap = node => {
					const wrappedPrecursor = node instanceof Node ?
						{ node } :
						node;

					if (typeof wrappedPrecursor.tolerance == "number") {
						wrappedPrecursor.xTolerance = wrappedPrecursor.tolerance;
						wrappedPrecursor.yTolerance = wrappedPrecursor.tolerance;
					}

					return Object.assign({
						xTolerance: 0,
						yTolerance: 0,
						detectVisibility: false
					}, wrappedPrecursor);
				};

				const pushWrap = (arr, node) => {
					arr.push(wrap(node));
				};

				const resolve = (targ, nodes = [], singular = true) => {
					if (typeof targ == "string") {
						const wrapper = this.$refs.wrapper;

						if (wrapper.matches(targ))
							pushWrap(nodes, wrapper);

						if (singular && nodes.length)
							return nodes;

						if (singular) {
							const node = wrapper.querySelector(targ);

							if (node)
								pushWrap(nodes, node);
						} else {
							const nds = wrapper.querySelectorAll(targ);

							for (let i = 0, l = nds.length; i < l; i++)
								pushWrap(nodes, nds[i]);
						}
					} else if (Array.isArray(targ)) {
						for (let i = 0, l = targ.length; i < l; i++) {
							if (singular && nodes.length)
								return nodes;

							concatMut(nodes, resolve(targ[i]));
						}
					} else if (isObject(targ)) {
						const wrapped = resolve(targ.node)[0];

						if (wrapped) {
							pushWrap(nodes, Object.assign({}, targ, {
								node: wrapped.node
							}));
						}
					}

					return nodes;
				};

				return resolve(
					this.scrollTarget || this.scrollTargets,
					[],
					Boolean(this.scrollTarget)
				);
			}
		},
		computed: {
			runtime() {
				return {
					...this.assets,
					expanded: this.expanded,
					direction: this.dropdownDirection
				};
			}
		},
		props: {
			input: null,
			readonly: Boolean,
			disabled: Boolean,
			meta: Object,
			adaptive: Boolean,
			flushDropdown: Boolean,
			flushWidth: Boolean,
			gap: {
				type: Number,
				default: 30
			},
			bias: {
				type: Number,
				default: 0.5
			},
			scrollTarget: [Node, String, Object],
			scrollTargets: [Node, String, Array]
		},
		beforeMount() {
			this.globalKeyListener = evt => {
				if (!this.expanded && !this.blurWeight && this.probeNodeIsFocused()) {
					switch (EVT.getKey(evt)) {
						case "enter":
							this.expand();
							evt.preventDefault();
							return;
					}
				}

				if (!this.expanded)
					return;

				const key = EVT.getKey(evt);

				switch (key) {
					case "escape":
						this.collapse();
						evt.preventDefault();
						break;
				}

				this.$emit("key", evt, key, this.runtime);
			};

			this.globalVisibilityListener = evt => {
				this.collapse();
				if (hasAncestor(document.activeElement, this.$refs.dropdown))
					document.activeElement.blur();
			};

			document.body.addEventListener("keydown", this.globalKeyListener);
			window.addEventListener("visibilitychange", this.globalVisibilityListener);
			this.$emit("assets", this.assets);
		},
		beforeDestroy() {
			document.body.removeEventListener("keydown", this.globalKeyListener);
			window.removeEventListener("keydown", this.globalVisibilityListener);
		}
	};
</script>
