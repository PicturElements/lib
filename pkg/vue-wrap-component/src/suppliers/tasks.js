import {
	hasOwn,
	isObject
} from "@qtxr/utils";

const taskHooks = ["beforeMount", "mounted", "beforeUpdate", "updated"];

export default {
	use({ wrapper, used }) {
		if (used)
			return;

		taskHooks.forEach(hookName => {
			wrapper.addHook(hookName, function() {
				const tasks = this.$props.tasks;
				runTasks(this, tasks, hookName);
			});
		});

		wrapper.addProp("tasks", null);
	}
};

function runTasks(vm, tasks, hookName) {
	if (!tasks)
		return;

	if (typeof tasks == "function")
		tasks(vm, hookName);
	else if (Array.isArray(tasks)) {
		for (let i = 0, l = tasks.length; i < l; i++) {
			if (typeof tasks[i] == "function")
				tasks[i](vm, hookName);
		}
	} else if (isObject(tasks)) {
		for (const k in tasks) {
			if (!hasOwn(tasks, k) || k != hookName)
				continue;

			const task = tasks[k];

			if (typeof task == "function")
				tasks[k](vm, hookName);
			else
				runTasks(vm, task);
		}
	}
}
