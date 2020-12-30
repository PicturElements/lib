import {
	composeOptionsTemplates,
	createOptionsObject
} from "./internal/options";
import hasOwn from "./has-own";

const OPTIONS_TEMPLATES = composeOptionsTemplates({
	pad: true,
	trimWhitespace: true,
	preserveEmptyLines: true,
	rfc: {
		delimiter: ",",
		quote: "\"",
		innerQuote: "\"\"",
		terminator: "\r\n",
		comment: null
	}
});

export default function parseCsv(csv, options = null) {
	csv = String(csv);
	options = createOptionsObject(options, OPTIONS_TEMPLATES);

	const delimiter = options.delimiter || ",",
		quote = options.quote || "\"",
		innerQuote = options.innerQuote || "\"\"",
		terminator = options.terminator || "\n",
		delimiterDelta = delimiter.length - 1,
		quoteDelta = quote.length - 1,
		innerQuoteDelta = innerQuote.length - 1,
		terminatorDelta = terminator.length - 1,
		comment = hasOwn(options, "comment") ?
			options.comment :
			"#",
		data = {
			header: [],
			records: []
		};
	let line = 0,
		buffer = "",
		record = [],
		withinQuotes = false,
		feedDisabled = false,
		minWidth = Infinity,
		maxWidth = -Infinity;

	const pushBuffer = str => {
		if (feedDisabled)
			return;

		buffer += str;
	};

	const pushField = _ => {
		if (feedDisabled) {
			feedDisabled = false;
			return;
		}

		const field = options.trimWhitespace ?
			buffer.trim() :
			buffer;

		record.push(field);

		buffer = "";
		feedDisabled = false;
	};

	const pushRecord = _ => {
		pushField();

		if (line && record.length == 1 && !record[0] && !options.preserveEmptyLines)
			return;

		if (line && options.pad && record.length < maxWidth)
			padRecord(record, maxWidth);

		const rLen = record.length;

		if (rLen < minWidth)
			minWidth = rLen;
		if (rLen > maxWidth)
			maxWidth = rLen;

		if (!line)
			data.header = record;
		else
			data.records.push(record);

		line++;
		record = [];
		feedDisabled = false;
	};

	const hasSubstring = (idx, sub) => {
		for (let i = 0, l = sub.length; i < l; i++) {
			if (csv[idx + i] != sub[i])
				return false;
		}
	
		return true;
	};

	for (let i = 0, l = csv.length; i < l; i++) {
		const char = csv[i];

		if (char == "\\") {
			if (i < l - 1) {
				pushBuffer(csv[i + 1]);
				i++;
			} else
				pushBuffer("\\");
		} else if (hasSubstring(i, delimiter)) {
			if (withinQuotes)
				pushBuffer(delimiter);
			else
				pushField();
			
			i += delimiterDelta;
		} else if (hasSubstring(i, quote)) {
			if (withinQuotes && hasSubstring(i, innerQuote)) {
				pushBuffer(quote);
				i += innerQuoteDelta;
			} else if (withinQuotes) {
				pushField();
				feedDisabled = true;
				withinQuotes = false;
				i += quoteDelta;
			} else {
				buffer = "";
				withinQuotes = true;
				i += quoteDelta;
			}
		} else if (hasSubstring(i, terminator)) {
			pushRecord();
			i += terminatorDelta;
		} else if (comment && !buffer && !record.length && hasSubstring(i, comment)) {
			for (let j = i + comment.length; j < l; j++) {
				if (hasSubstring(j, terminator) || j == l - 1) {
					i = j;
					break;
				}
			}
		} else
			pushBuffer(char);
	}

	if (record.length || buffer)
		pushRecord();

	if (options.pad && data.records.length && minWidth != maxWidth) {
		for (let i = 0, l = data.records.length; i < l; i++)
			padRecord(data.records[i], maxWidth);

		padRecord(data.header, maxWidth);
	}

	return data;
}

function padRecord(record, length) {
	for (let i = record.length; i < length; i++)
		record.push("");
}
