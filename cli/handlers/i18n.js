const Commander = require("../commander");
const path = require("path");

const commands = new Commander()
	.cmd("mkmap", (options, ...args) => {
		console.log("generating sitemap...");
	});

module.exports = commands;
