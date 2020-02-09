import { el } from "../utils";

export default function panel() {
	return el`
		.panel
			.panel-header
				.panel-header-left
					button.header-button.expando
						svg(viewBox="0 0 10 10")
							path(d="M3 4 l2 2 l2 -2")
					button.header-button.clear
						svg(viewBox="0 0 10 10")
							path(d="M3.5 3.5 l3 3 M3.5 6.5 l3 -3")
				.panel-header-right
					.stats
						.stat.errors(data-count="0")
						.stat.warnings(data-count="0")
						.stat.logs(data-count="0")
			.panel-content
	`;
}
