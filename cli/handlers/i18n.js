const Commander = require("../commander");

const commands = new Commander()
	.cmd("mkmap", options => {
		console.log("generating sitemap...");
	});

module.exports = commands;
