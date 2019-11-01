<template lang="pug">
	.admin-login-screen
		RepatingPattern
		.login-form.card
			.login-error.error-label(v-if="$parent.loginCell.state.error")
				| {{ $parent.loginCell.state.errorMsg }}
			VForm.light(
				:form="form"
				:rows="rows")
			button.admin-btn(
				:disabled="!form.valid"
				@click="login") Log in
			LoadingBox(:cell="$parent.loginCell")
				LoadingIcon
		.login-credit.f(v-if="admin.config.appearance.login.credit")
			Icon.ico-qtxr-logo
			span.f.ac powered by qtxr
</template>

<script>
	import admin from "../admin";
	import * as components from "@qtxr/vue-admin/components";

	import Form from "@qtxr/form";
	import VForm from "@qtxr/vue-form";

	import RepatingPattern from "./repeating-pattern.vue";
	import Icon from "./icon.vue";
	import LoadingIcon from "./loading-icon.vue";

	const component = admin.wrapC({
		name: "Login",
		data() {
			return {
				form: new Form("std"),
				rows: [
					Form.mod("email", false, {
						name: "email",
						title: "Email"
					}),
					Form.mod("password", false, {
						name: "password",
						title: "Password"
					})
				]
			}
		},
		methods: {
			login() {
				this.$parent.loginCell.fetch()
					.then(response => {
						if (response.success)
							this.commit("session/login");
					});
			}
		},
		computed: {},
		props: {},
		components: {
			...components,
			Icon,
			VForm,
			RepatingPattern,
			LoadingIcon
		}
	});

	export default component.export();
</script>

<style lang="scss">
	@use "../assets/scss/theme.scss" as *;

	.admin-login-screen {
		display: flex;
		justify-content: center;
		align-items: center;
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		z-index: 100000;

		.repeating-pattern {
			position: absolute;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
		}

		.login-form {
			z-index: 10;

			input {
				min-width: 200px;
				font-size: 100%;
			}

			.input-box p {
				font-size: 90%;
			}

			button {
				width: 100%;
				margin-top: 18px;
			}
		}

		.login-credit {
			position: absolute;
			left: 50%;
			bottom: 15px;
			transform: translateX(-50%);
			color: $stamp-color;

			.ico-qtxr-logo {
				width: 20px;
				height: 20px;
				opacity: 0.8;
			}

			span {
				font-size: 110%;
				margin-left: 5px;
			}
		}
	}
</style>
