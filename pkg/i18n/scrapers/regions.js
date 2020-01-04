// Country selection from https://en.wikipedia.org/wiki/List_of_administrative_divisions_by_country
// Divisions refer to, with a few exceptions for small countries, the first-level administrative
// divisions for each country. As divisions are subject to geopolitics, the data is retrieved fresh
// by requesting data from Wikipedia. This is done with a query syntax as follows:
// cc country: selector x count @ wiki-slug
// where
// cc is the ISO 3166-1 alpha-2 code for the country
// country is the country name spelled out in full
// selector is a CSS selector that selects elements containing text data pertaining to division names
// count is a check number that ensures that the selector matches a set amount of times (optional, recommended)
// wiki-slug is the identifying slug for the target Wikipedia article (https://en.wikipedia.org/wiki/ >>> List_of_administrative_divisions_by_country <<<)
//
// It is strongly recommended that a check count number is specified. Otherwise there is a greater risk that
// unwanted elements are selected by the selector. If the check fails, an error will be thrown specifying
// how many matches are expected vs. the number received.

const queries = [
	"af Afghanistan: .wikitable td:first-child > a x 34 @ Provinces_of_Afghanistan",
	"al Albania: .wikitable td:nth-child(2) > a x 12 @ Counties_of_Albania",
	"dz Algeria: .wikitable tr:not(.sortbottom) td:nth-child(2) > a x 48 @ Provinces_of_Algeria",
	"ad Andorra: .wikitable td:first-child > a + a x 7 @ Parishes_of_Andorra",
	"ao Angola: .thumb ~ ul li x 18 @ Subdivisions_of_Angola",
	"ag Antigua and Barbuda: .wikitable tr:not(:last-child) td:nth-child(2) x 8 @ Parishes_and_dependencies_of_Antigua_and_Barbuda",
	"ar Argentina: .wikitable td:nth-child(2) x 24 @ Provinces_of_Argentina",
	"am Armenia: p + .wikitable td:first-child x 11 @ Administrative_divisions_of_Armenia",
	"au Australia: .wikitable + p + .wikitable td:nth-child(2), .wikitable + .wikitable td:nth-child(2) x 16 @ States_and_territories_of_Australia",
	"at Austria: .wikitable:not(.sortable) td:nth-child(2) x 9 @ States_of_Austria",
	"az Azerbaijan: .thumb + .wikitable td:nth-child(2) x 10 @ Administrative_divisions_of_Azerbaijan",
	"bs Bahamas: .thumb + h2 + p + p + .wikitable td:first-child, .wikitable + ul li x 33 @ Local_government_in_The_Bahamas",
	"bh Bahrain: .wikitable tr + tr ~ tr td:first-child b + a x 4 @ Governorates_of_Bahrain",
	"bd Bangladesh: .wikitable tr:not(.sortbottom) td:first-child x 8 @ Divisions_of_Bangladesh",
	"bb Barbados: .wikitable tr:not(.sortbottom) td:nth-child(2) x 11 @ Parishes_of_Barbados",
	"by Belarus: .wikitable tr + tr ~ tr td:nth-child(3) x 7 @ Regions_of_Belarus",
	"be Belgium: .wikitable + p + p + h2 + .wikitable th + th a x 3 @ Communities%2C_regions_and_language_areas_of_Belgium",
	"bz Belize: .wikitable td:first-child x 6 @ Districts_of_Belize",
	"bj Benin: .wikitable td:nth-child(2) x 12 @ Departments_of_Benin",
	"bt Bhutan: .wikitable th:first-child > a:first-child x 20 @ Districts_of_Bhutan",
	"bo Bolivia: .wikitable tr + tr th:first-child x 9 @ Departments_of_Bolivia",
	"ba Bosnia and Herzegovina: .toccolours td:nth-child(3) a, .toccolours td:nth-child(7) a x 10 @ Federation_of_Bosnia_and_Herzegovina",
	"bw Botswana: .wikitable tr + tr td:first-child x 17 @ Districts_of_Botswana",
	"br Brazil: h2 + .wikitable td:first-child a x 27 @ States_of_Brazil",
	"bn Brunei: .wikitable td:first-child x 4 @ Districts_of_Brunei",
	"bg Bulgaria: .wikitable.sortable td:first-child x 28 @ Provinces_of_Bulgaria",
	"bf Burkina Faso: .wikitable.sortable td:first-child x 13 @ Regions_of_Burkina_Faso",
	"bi Burundi: .wikitable td:first-child:not(:last-child) x 18 @ Provinces_of_Burundi",
	"kh Cambodia: .wikitable td:first-child x 25 @ Provinces_of_Cambodia",
	"cm Cameroon: .wikitable td:nth-child(2) x 10 @ Regions_of_Cameroon",
	"ca Canada: .wikitable tr th:not(.headerSort) a + a x 13 @ Provinces_and_territories_of_Canada",
	"cv Cape Verde: .wikitable td:nth-child(2) x 22 @ Administrative_divisions_of_Cape_Verde",
	"cf Central African Republic: .wikitable td:nth-child(2) a x 17 @ Prefectures_of_the_Central_African_Republic",
	"td Chad: p + div .wikitable td:nth-child(2) a x 23 @ Regions_of_Chad",
	"cl Chile: .wikitable td:nth-child(2) a x 16 @ Regions_of_Chile",
	"cn China: .wikitable td:nth-child(3) > a:first-child x 34 @ Provinces_of_China",
	"co Colombia: .wikitable td:nth-child(2) a x 33 @ Departments_of_Colombia",
	"km Comoros: p + h2 + ul li a x 4 @ List_of_islands_of_the_Comoros",
	"cd DR Congo: table + p + table td a:not(.image):not(.internal) x 26 @ Provinces_of_the_Democratic_Republic_of_the_Congo",
	"cg Congo: .wikitable td:first-child x 12 @ Departments_of_the_Republic_of_the_Congo",
	"cr Costa Rica: .wikitable td:nth-child(2) x 7 @ Provinces_of_Costa_Rica",
	"ci Ivory Coast: .wikitable th + td a x 14 @ Districts_of_Ivory_Coast",
	"hr Croatia: .hatnote + .wikitable tr th:first-child > a x 21 @ Counties_of_Croatia",
	"cu Cuba: h2 + p + ol li a x 16 @ Provinces_of_Cuba",
	"cy Cyprus: .wikitable td:first-child a x 6 @ Districts_of_Cyprus",
	"cz Czech Republic: .wikitable td:nth-child(2) a x 14 @ Regions_of_the_Czech_Republic",
	"dk Denmark: .floatright a x 5 @ Regions_of_Denmark",
	"dj Djibouti: .wikitable td:first-child x 6 @ Regions_of_Djibouti",
	"dm Dominica: .wikitable th:first-child a x 10 @ Parishes_of_Dominica",
	"do Dominican Republic: .wikitable tr:not(:last-child) td:first-child x 32 @ Provinces_of_the_Dominican_Republic",
	"tl East Timor: .wikitable td:nth-child(2) a x 13 @ Municipalities_of_East_Timor",
	"ec Ecuador: .wikitable td:nth-child(2) a x 24 @ Provinces_of_Ecuador",
	"eg Egypt: .wikitable td:nth-child(2) a x 27 @ Governorates_of_Egypt",
	"sv El Salvador: .wikitable td:nth-child(3) a x 14 @ Departments_of_El_Salvador",
	"gq Equatorial Guinea: .wikitable td:nth-child(2) a x 8 @ Provinces_of_Equatorial_Guinea",
	"er Eritrea: .wikitable td:first-child a x 6 @ Regions_of_Eritrea",
	"ee Estonia: .wikitable td:nth-child(2) a x 15 @ Counties_of_Estonia",
	"sz Eswatini: .wikitable td:nth-child(2) a x 4 @ Regions_of_Eswatini",
	"et Ethiopia: .wikitable td:nth-child(3) a x 11 @ Regions_of_Ethiopia",
	"fj Fiji: h2 + table td[rowspan] a:first-child, h2 + table td[colspan] a:first-child x 5 @ Local_government_in_Fiji",
	"fi Finland: .wikitable td:nth-child(5) b x 19 @ Regions_of_Finland",
	"fr France: h2 + .wikitable td:nth-child(2) > a x 18 @ Regions_of_France",
	"ga Gabon: .wikitable td:nth-child(2) a x 9 @ Subdivisions_of_Gabon",
	"gm Gambia: .wikitable td:first-child a x 6 @ Subdivisions_of_the_Gambia",
	"ge Georgia: .infobox + .infobox td:nth-child(2) a x 12 @ Administrative_divisions_of_Georgia_(country)",
	"de Germany: .wikitable td:nth-child(3) a x 16 @ States_of_Germany",
	"gh Ghana: .wikitable td:nth-child(2) a x 16 @ List_of_Ghanaian_regions_by_area",
	"gr Greece: .floatleft + p span + a x 8 @ Decentralized_administrations_of_Greece s/Decentralized Administration of (?:the )?|Autonomous Monastic State of /",
	"gd Grenada: .floatright ~ div:not(:last-child):not(:nth-last-child(2)) a x 7 @ Parishes_of_Grenada s/([a-z])([A-Z])/$1 $2",
	"gt Guatemala: .wikitable td:nth-child(3) a x 22 @ Departments_of_Guatemala",
	"gn Guinea: .wikitable td:first-child a x 8 @ Regions_of_Guinea",
	"gw Guinea-Bissau: .wikitable td:first-child a x 9 @ Regions_of_Guinea-Bissau",
	"gy Guyana: .wikitable td:nth-child(2) a x 10 @ Regions_of_Guyana",
	"ht Haiti: .wikitable td:nth-child(2) a x 10 @ Departments_of_Haiti",
	"hn Honduras: .wikitable td:nth-child(2) a x 18 @ Departments_of_Honduras",
	"hu Hungary: .wikitable tr:not(:last-child) th:first-child a x 20 @ Counties_of_Hungary",
	"is Iceland: .wikitable td:first-child a x 72 @ Municipalities_of_Iceland",
	"in India: .wikitable th:first-child a x 37 @ States_and_union_territories_of_India",
	"id Indonesia: h3 + .wikitable td:nth-child(2) > a, h3 + .wikitable td:nth-child(2) > span a x 34 @ Provinces_of_Indonesia",
	"ir Iran: .wikitable tr:not(.sortbottom) td:first-child a x 31 @ Provinces_of_Iran",
	"iq Iraq: .wikitable td:first-child a x 19 @ Governorates_of_Iraq",
	"ie Ireland: .wikitable td:first-child a x 31 @ Local_government_in_the_Republic_of_Ireland s/(?:City)?(?: and )?(?:County)? Council/",
	"il Israel: .mw-parser-output > h2 > span:first-child:not(#See_also):not(#Notes):not(#References):not(#External_links) x 7 @ Districts_of_Israel",
	"it Italy: .timeline-wrapper + h2 + .wikitable td:nth-child(2) a x 20 @ Regions_of_Italy",
	"jm Jamaica: h2 + .wikitable td:nth-child(2) a x 14 @ Parishes_of_Jamaica",
	"jp Japan: dl + .wikitable td:first-child a x 47 @ Prefectures_of_Japan",
	"jo Jordan: .wikitable td:first-child:not(:empty) + td a x 12 @ Governorates_of_Jordan",
	"kz Kazakhstan: p + .wikitable td:nth-child(2) a x 18 @ Regions_of_Kazakhstan",
	"ke Kenya: h2 + p + .wikitable td:nth-child(2) a x 47 @ Counties_of_Kenya",
	"ki Kiribati: ol li a:first-child x 24 @ Subdivisions_of_Kiribati",
	"kw Kuwait: .wikitable tr:not(:last-child) td:first-child a x 6 @ Governorates_of_Kuwait s/Governorate/",
	"kg Kyrgyzstan: .wikitable td:nth-child(2) a x 9 @ Regions_of_Kyrgyzstan s/Region/",
	"la Laos: .wikitable td:nth-child(2) a x 18 @ Provinces_of_Laos",
	"lv Latvia: .wikitable td:nth-child(2) a x 119 @ Administrative_divisions_of_Latvia",
	"lb Lebanon: .wikitable td:first-child a x 8 @ Governorates_of_Lebanon",
	"ls Lesotho: .wikitable td:nth-child(2) a x 10 @ Districts_of_Lesotho",
	"lr Liberia: .wikitable td:nth-child(2) a x 15 @ Counties_of_Liberia",
	"ly Libya: .wikitable td:nth-child(3) a x 22 @ Districts_of_Libya",
	"li Liechtenstein: .wikitable tr:not(:last-child) td:nth-child(2) a x 11 @ Municipalities_of_Liechtenstein",
	"lt Lithuania: .wikitable tr:not(:last-child) td:nth-child(2) > a:first-child x 10 @ Counties_of_Lithuania",
	"lu Luxembourg: .multicol ul ul li a x 12 @ Cantons_of_Luxembourg",
	"mk Madagascar: .wikitable td:nth-child(2) > a x 22 @ Regions_of_Madagascar",
	"mw Malawi: .mw-parser-output li span + a x 3 @ Regions_of_Malawi",
	"my Malaysia: .wikitable td:nth-child(3) a x 16 @ States_and_federal_territories_of_Malaysia",
	"mv Maldives: .wikitable td:nth-child(6) x 21 @ Administrative_divisions_of_the_Maldives",
	"ml Mali: .wikitable td:first-child x 11 @ Regions_of_Mali",
	"mt Malta: h3 + .wikitable td:nth-child(2) a x 5 @ Regions_of_Malta",
	"mh Marshall Islands: .toc + h2 + p + .wikitable td:first-child > a x 24 @ List_of_islands_of_the_Marshall_Islands",
	"mr Mauritania: .wikitable td:nth-child(2) a x 15 @ Regions_of_Mauritania",
	"mx Mexico: .wikitable td:first-child a x 32 @ List_of_states_of_Mexico",
	"fm Micronesia: .wikitable td:nth-child(2) a x 4 @ States_of_the_Federated_States_of_Micronesia",
	"md Moldova: p + ul + .wikitable td:first-child a x 32 @ Administrative_divisions_of_Moldova",
	"mc Monaco: Monaco",
	"mn Mongolia: .wikitable td:first-child a x 22 @ Provinces_of_Mongolia",
	"me Montenegro: .wikitable td:nth-child(3) a x 24 @ Municipalities_of_Montenegro",
	"ma Morocco: .toc + h2 + p + .wikitable td:nth-child(3) > a x 12 @ Regions_of_Morocco",
	"mz Mozambique: .wikitable td:nth-child(2) a x 11 @ Provinces_of_Mozambique",
	"mm Myanmar: .wikitable td:nth-child(2) a, .wikitable td:first-child a:not(.image) x 21 @ Administrative_divisions_of_Myanmar",
	"na Namibia: .wikitable td:nth-child(2) a x 14 @ Regions_of_Namibia",
	"nr Nauru: .wikitable td:nth-child(2) a x 14 @ Nauru",
	"np Nepal: .wikitable td:first-child a x 7 @ Provinces_of_Nepal",
	"nl Netherlands: .wikitable th:first-child span + a x 12 @ Provinces_of_the_Netherlands",
	"nz New Zealand: .wikitable td:nth-child(2) a x 16 @ Regions_of_New_Zealand",
	"ni Nicaragua: .wikitable td:nth-child(3) a x 17 @ Departments_of_Nicaragua",
	"ne Niger: .wikitable td:first-child a x 8 @ Regions_of_Niger",
	"ng Nigeria: table ol li a, table[align=right] td a x 37 @ States_of_Nigeria",
	"kp North Korea: .wikitable td:first-child a x 9 @ Provinces_of_North_Korea",
	"mk North Macedonia: .wikitable td:first-child a x 8 @ Statistical_regions_of_North_Macedonia",
	"no Norway: .wikitable td:nth-child(2) > a x 18 @ Counties_of_Norway",
	"om Oman: .wikitable td:first-child a x 11 @ Governorates_of_Oman",
	"pk Pakistan: .wikitable tr:not(.sortbottom) td:first-child > a x 7 @ Administrative_units_of_Pakistan",
	"pw Palau: .wikitable td:first-child .image + a x 16 @ States_of_Palau",
	"ps Palestine: .thumb + .wikitable td:first-child a x 16 @ Governorates_of_Palestine",
	"pa Panama: h2 + .wikitable td:first-child a, h2 + h3 + .wikitable td:first-child a x 13 @ Provinces_of_Panama",
	"pg Papua New Guinea: .wikitable td:nth-child(3) .image + a x 22 @ Provinces_of_Papua_New_Guinea",
	"py Paraguay: .wikitable tr:not(:last-child) td:nth-child(2) .image + a, .wikitable tr:nth-child(2) td:nth-child(3) a x 18 @ Departments_of_Paraguay",
	"pe Peru: .wikitable td:first-child a x 25 @ Regional_circumscriptions_of_Peru",
	"ph Philippines: .wikitable td:nth-child(2) > a x 17 @ Regions_of_the_Philippines",
	"pl Poland: .wikitable td:nth-child(6) a x 16 @ Voivodeships_of_Poland",
	"pt Portugal: .wikitable td:first-child a x 18 @ Districts_of_Portugal",
	"qa Qatar: .wikitable td:nth-child(2) a x 8 @ Municipalities_of_Qatar",
	"ro Romania: .wikitable tr > *:first-child a:not(.image) x 42 @ Counties_of_Romania",
	"ru Russia: .thumb + .wikitable td:nth-child(2) > a x 85 @ Federal_subjects_of_Russia",
	"rw Rwanda: .wikitable td:first-child a x 5 @ Provinces_of_Rwanda",
	"kn Saint Kitts and Nevis: table ol li a:first-child x 14 @ Saint_Kitts_and_Nevis",
	"lc Saint Lucia: .toc + h2 + .wikitable td:nth-child(2) a x 11 @ Quarters_of_Saint_Lucia",
	"vc Saint Vincent and the Grenadines: .wikitable td:first-child a x 6 @ Parishes_of_Saint_Vincent_and_the_Grenadines",
	"ws Samoa: .wikitable tr:not(:nth-last-child(5)) td:nth-child(2) a x 11 @ Districts_of_Samoa",
	"sm San Marino: .wikitable td:first-child .image + a x 9 @ Municipalities_of_San_Marino",
	"st São Tomé and Príncipe: .wikitable td:nth-child(2) a x 7 @ Districts_of_São_Tomé_and_Príncipe",
	"sa Saudi Arabia: .wikitable td:first-child:not([colspan]) a x 13 @ Regions_of_Saudi_Arabia",
	"sn Senegal: .wikitable td:first-child a x 14 @ Regions_of_Senegal",
	"rs Serbia: .wikitable td:first-child a:first-child x 29 @ Districts_of_Serbia, Belgrade",
	"sc Seychelles: .wikitable td:nth-child(2) > a x 30 @ Districts_of_Seychelles",
	"sl Sierra Leone: .toc + h2 + ul li a x 4 @ Provinces_of_Sierra_Leone",
	"sg Singapore: .toc + h2 + p + ul li a x 5 @ Community_Development_Council",
	"sk Slovakia: .wikitable td:nth-child(3) a x 8 @ Regions_of_Slovakia",
	"si Slovenia: .wikitable td:nth-child(2) a x 212 @ Municipalities_of_Slovenia",
	"sb Solomon Islands: .wikitable tr:not(:nth-last-child(2)) td:nth-child(2) > a, .wikitable tr:nth-last-child(2) td:nth-child(3) > a x 10 @ Provinces_of_Solomon_Islands",
	"so Somalia: .wikitable td:first-child > a x 18 @ Administrative_divisions_of_Somalia",
	"za South Africa: p + h2 + .wikitable td:first-child > a x 9 @ Provinces_of_South_Africa",
	"kr South Korea: .wikitable b x 9 @ Provinces_of_South_Korea",
	"ss South Sudan: .wikitable td:first-child a:not(.image) x 32 @ States_of_South_Sudan",
	"es Spain: h2 + .wikitable td:nth-child(2) a, h3 + .wikitable td:nth-child(3) a x 19 @ Autonomous_communities_of_Spain",
	"lk Sri Lanka: .wikitable td:first-child .flagicon + a x 9 @ Provinces_of_Sri_Lanka",
	"sd Sudan: ol + ul a x 18 @ States_of_Sudan s/\\\\(state\\\\)/",
	"sr Suriname: .wikitable td:nth-child(2) a x 10 @ Districts_of_Suriname",
	"se Sweden: .wikitable td:nth-child(5) a x 21 @ Counties_of_Sweden",
	"ch Switzerland: .wikitable td + th:nth-child(3) a:first-child x 26 @ Cantons_of_Switzerland",
	"sy Syria: h2 + .wikitable td:first-child a x 14 @ Governorates_of_Syria s/Governorate/",
	"tj Tajikistan: .wikitable td:nth-child(2) a x 5 @ Regions_of_Tajikistan",
	"tz Tanzania: .wikitable td:first-child a x 31 @ Regions_of_Tanzania s/Region/",
	"th Thailand: .wikitable td:nth-child(2) .flagicon + a x 77 @ Provinces_of_Thailand",
	"tg Togo: .wikitable td:first-child a x 5 @ Regions_of_Togo",
	"to Tonga: .toc + h2 + .wikitable tr:not(:last-child) td:first-child a x 5 @ Administrative_divisions_of_Tonga",
	"tt Trinidad and Tobago: .wikitable td:first-child a x 14 @ Regional_corporations_and_municipalities_of_Trinidad_and_Tobago",
	"tn Tunisia: .wikitable td:nth-child(2) a x 24 @ Governorates_of_Tunisia",
	"tr Turkey: .toc + h2 + p + .wikitable td:nth-child(2) a x 81 @ Provinces_of_Turkey",
	"tm Turkmenistan: .wikitable th:first-child a x 6 @ Regions_of_Turkmenistan",
	"tv Tuvalu: .wikitable tr:not(:nth-last-child(2)) td:first-child:not([colspan]) a x 9 @ List_of_islands_of_Tuvalu",
	"ug Uganda: .wikitable td a x 128 @ Districts_of_Uganda",
	"ua Ukraine: .hatnote + p + p + .wikitable td:first-child a, .hatnote + p + .wikitable td:first-child a x 27 @ Administrative_divisions_of_Ukraine",
	"ae United Arab Emirates: .wikitable td:nth-child(2) a x 7 @ Emirates_of_the_United_Arab_Emirates",
	"gb United Kingdom: .wikitable td:first-child > a x 48 @ Ceremonial_counties_of_England, .wikitable td:first-child a x 6 @ Counties_of_Northern_Ireland, h3 + ul + .wikitable td:nth-child(2) a x 32 @ Subdivisions_of_Scotland, .wikitable td:first-child a x 18 @ History_of_local_government_in_Wales",
	"us United States: .wikitable th:first-child .flagicon + a x 56 @ List_of_states_and_territories_of_the_United_States",
	"uy Uruguay: .wikitable td:nth-child(2) a x 19 @ Departments_of_Uruguay",
	"uz Uzbekistan: .wikitable th:first-child a x 14 @ Regions_of_Uzbekistan",
	"vu Vanuatu: .mw-parser-output table + p + .wikitable tr:not(.sortbottom) td:first-child a x 6 @ Provinces_of_Vanuatu",
	"va Vatican City: Vatican City",
	"ve Venezuela: .hatnote + .wikitable td:nth-child(2) a, h2 + .wikitable td:nth-child(3) a x 25 @ States_of_Venezuela",
	"vn Vietnam: p + p + .wikitable td:first-child a x 63 @ Provinces_of_Vietnam",
	"ye Yemen: .wikitable td:first-child:not([colspan]) a x 22 @ Governorates_of_Yemen",
	"zm Zambia: h2 + .wikitable td:first-child > a x 10 @ Provinces_of_Zambia",
	"zw Zimbabwe: h2 + .wikitable th:first-child a x 10 @ Provinces_of_Zimbabwe",
	"tw Taiwan: .hatnote + p + .wikitable td:first-child > a x 6 @ Special_municipality_(Taiwan)",
	"xk Kosovo: .wikitable td:first-child > a x 7 @ Districts_of_Kosovo",
	"cy Northern Cyprus: .wikitable td:first-child a x 6 @ Districts_of_Northern_Cyprus",
	"md Transnistria: .mw-parser-output ul li a x 6 @ Administrative_divisions_of_Transnistria"
];

async function getSubdivisions(queryStr, verbose = false) {
	const splitRegex = /(\w{2})\s*(.+?)\s*:\s*(.+)/,
		queryRegex = /(?:(.+?)\s*(?:x\s*(\d+))?\s*@\s*(.+?)\s*(?:s\/((?:\\.|[^\/])+?)\/(.*?))?|\s*(.+?))\s*(?:,|$)/g,
		subdivisions = [],
		start = performance.now();

	const [
		_,
		countryCode,
		country,
		query
	] = queryStr.match(splitRegex);

	while (true) {
		const ex = queryRegex.exec(query);
		if (!ex)
			break;

		const [
			_,
			selector,
			count,
			id,
			regex,
			replace,
			raw
		] = ex;

		if (raw) {
			const val = raw.trim();

			if (!val)
				throw new Error(`Found empty value (${country})`);

			subdivisions.push(val);
		} else {
			const res = await fetch(`https://en.wikipedia.org/wiki/${id}`);
			const markup = await res.text();
			const dom = document.createElement("div");
			dom.innerHTML = markup;
			const nodes = dom.querySelectorAll(selector);

			if (count && Number(count) != nodes.length)
				throw new Error(`Invalid number of subdivisions found (expected ${count}, got ${nodes.length}, for ${country})`);

			for (const node of nodes) {
				let val = node.textContent;

				if (regex) {
					const reg = new RegExp(regex.replace(/\\(.)/g, "$1"));
					val = val.replace(reg, replace);
				}

				val = val.trim();

				if (!val)
					throw new Error(`Found empty value (${country})`);

				subdivisions.push(val);
			}
		}
	}

	if (verbose)
		console.log(`Collected ${country} (${(performance.now() - start).toPrecision(3)}ms):`, subdivisions);
	else
		console.log(`Collected ${country} (${(performance.now() - start).toPrecision(3)}ms)`);

	return {
		country,
		countryCode,
		subdivisions: subdivisions.sort()
	};
}

async function collect(qs = queries, verbose = false) {
	const out = [],
		start = performance.now();

	console.log("Collecting...");

	for (const queryStr of qs) {
		const val = await getSubdivisions(queryStr, verbose);
		out.push(val);
	}

	console.log(`Collection finished (${((performance.now() - start) / 1e3).toPrecision(3)}s)`, out);
	return out.sort((a, b) => a.country > b.country ? 1 : -1);
}


export {
	getSubdivisions,
	collect
};
