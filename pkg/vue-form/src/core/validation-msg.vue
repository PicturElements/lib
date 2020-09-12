<template lang="pug">
	.validation-msg(
		:class="{ active: msg }"
		:aria-errormessage="input.uid"
		:aria-hidden="!msg"
		aria-live="polite") {{ msg }}
</template>

<script>
	export default {
		name: "ValidationMsg",
		props: {
			input: Object,
			msg: String
		}
	};
</script>
