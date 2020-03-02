import feed from "../../../runtime/feed";
import * as exp from "../";
import I18NManager from "../";

feed(exp, "I18NManager");

feed.add("I18N", activeFeed => {
	const I18N = new I18NManager({
		baseUrl: "pkg/i18n/connect/locales",
		files: {
			structure: "dir"
		}
	});

	I18N.setLocale("en-uk");

	return I18N;
});

feed.example("greeting", {
	require: ["I18N"],
	description: "Logs a greeting for each loaded locale",
	handler({ I18N }) {
		I18N.locales.forEach(locale => {
			console.log(`${locale}:`, "\t", I18N.get("greetings.hello", locale));
		});
	}
});

feed.example("get", {
	require: ["I18N"],
	description: "Logs a gotten value for each loaded locale",
	handler({ I18N }) {
		return accessor => {
			I18N.locales.forEach(locale => {
				console.log(`${locale}:`, "\t", I18N.get(accessor, locale));
			});
		};
	}
});
