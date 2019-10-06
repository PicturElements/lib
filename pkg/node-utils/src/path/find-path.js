const { exists } = require("../fs/general");

module.exports = async function findUrl(...urls) {
	for (const url of urls) {
		if (await exists(url))
			return url;
	}

	return null;
};
