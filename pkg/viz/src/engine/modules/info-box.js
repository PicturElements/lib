import { node } from "../../utils";

export default class InfoBox {
	constructor(dataset) {
		this.dataset = dataset;
		this.dom = {};
	}

	render(wrapper, primary) {
		const dataset = this.dataset;

		if (primary)
			wrapper = node("div", "viz-graph-info-wrapper").app(wrapper);

		if (dataset.renderInfoBox === false)
			return;

		const infoCtrl = node("div", "viz-graph-info-control", null, {
				data: {
					owner: dataset.id
				}
			}),
			infoItem = node("div", "viz-graph-info-item").app(infoCtrl),
			title = node("div", "viz-graph-title viz-graph-info-component", dataset.title || dataset.type).app(infoItem),
			legend = node("div", "viz-graph-legend viz-graph-info-component").app(infoItem),
			ctrlBox = node("div", "viz-graph-control-box").app(infoCtrl);

		infoCtrl.app(wrapper);

		this.dom = {
			wrapper,
			infoCtrl,
			infoItem,
			title,
			legend,
			ctrlBox
		};
	}

	addInfoComponent(item) {
		const infoItem = this.dom.infoItem;

		if (infoItem) {
			item.classList.add("viz-graph-info-component");
			infoItem.appendChild(item);
		}

		return item;
	}

	setTitle(title) {
		const titleDom = this.dom.title;

		if (titleDom) {
			titleDom.textContent = title;
			this.dataset.title = title;
		}
	}
}
