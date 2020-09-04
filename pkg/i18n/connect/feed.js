import feed from "../../../runtime/feed";
import I18NManager, * as exp from "../";

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

feed.example("dateDiff", {
	require: ["I18N"],
	description: "Prints a date difference",
	handler({ I18N }) {
		return I18N.dfmt("$dateDiff($d(2020, 1, 12), 3, [$spacing, ' '], [yy, $label], [ll, $label], [dd, $label], [hh, $label], [mm, $label], [ss, $label])", {
			spacing: a => a.index < a.length - 1 || a.length < 2 ? ", " : ", and ",
			label: a => a.formatter.class + (Number(a.value) == 1 ? "" : "s")
		});
	}
});
