const queries = [
	"Afghanistan: .wikitable td:first-child > a x 34 @ Provinces_of_Afghanistan",
	"Albania: .wikitable td:nth-child(2) > a x 12 @ Counties_of_Albania",
	"Algeria: .wikitable tr:not(.sortbottom) td:nth-child(2) > a x 48 @ Provinces_of_Algeria",
	"Andorra: .wikitable td:first-child > a + a x 7 @ Parishes_of_Andorra",
	"Angola: .thumb ~ ul li x 18 @ Subdivisions_of_Angola",
	"Antigua and Barbuda: .wikitable tr:not(:last-child) td:nth-child(2) x 8 @ Parishes_and_dependencies_of_Antigua_and_Barbuda",
	"Argentina: .wikitable td:nth-child(2) x 24 @ Provinces_of_Argentina",
	"Armenia: p + .wikitable td:first-child x 11 @ Administrative_divisions_of_Armenia",
	"Australia: .wikitable + p + .wikitable td:nth-child(2), .wikitable + .wikitable td:nth-child(2) x 16 @ States_and_territories_of_Australia",
	"Austria: .wikitable:not(.sortable) td:nth-child(2) x 9 @ States_of_Austria",
	"Azerbaijan: .thumb + .wikitable td:nth-child(2) x 10 @ Administrative_divisions_of_Azerbaijan",
	"Bahamas: .thumb + h2 + p + p + .wikitable td:first-child, .wikitable + ul li x 33 @ Local_government_in_The_Bahamas",
	"Bahrain: .wikitable tr + tr ~ tr td:first-child b + a x 4 @ Governorates_of_Bahrain",
	"Bangladesh: .wikitable tr:not(.sortbottom) td:first-child x 8 @ Divisions_of_Bangladesh",
	"Barbados: .wikitable tr:not(.sortbottom) td:nth-child(2) x 11 @ Parishes_of_Barbados",
	"Belarus: .wikitable tr + tr ~ tr td:nth-child(3) x 7 @ Regions_of_Belarus",
	"Belgium: .wikitable + p + p + h2 + .wikitable th + th a x 3 @ Communities%2C_regions_and_language_areas_of_Belgium",
	"Belize: .wikitable td:first-child x 6 @ Districts_of_Belize",
	"Benin: .wikitable td:nth-child(2) x 12 @ Departments_of_Benin",
	"Bhutan: .wikitable th:first-child > a:first-child x 20 @ Districts_of_Bhutan",
	"Bolivia: .wikitable tr + tr th:first-child x 9 @ Departments_of_Bolivia",
	"Bosnia and Herzegovina: .toccolours td:nth-child(3) a, .toccolours td:nth-child(7) a x 10 @ Federation_of_Bosnia_and_Herzegovina",
	"Botswana: .wikitable tr + tr td:first-child x 17 @ Districts_of_Botswana",
	"Brazil: h2 + .wikitable td:first-child a x 27 @ States_of_Brazil",
	"Brunei: .wikitable td:first-child x 4 @ Districts_of_Brunei",
	"Bulgaria: .wikitable.sortable td:first-child x 28 @ Provinces_of_Bulgaria",
	"Burkina Faso: .wikitable.sortable td:first-child x 13 @ Regions_of_Burkina_Faso",
	"Burundi: .wikitable td:first-child:not(:last-child) x 18 @ Provinces_of_Burundi",
	"Cambodia: .wikitable td:first-child x 25 @ Provinces_of_Cambodia",
	"Cameroon: .wikitable td:nth-child(2) x 10 @ Regions_of_Cameroon",
	"Canada: .wikitable tr th:not(.headerSort) a + a x 13 @ Provinces_and_territories_of_Canada",
	"Cape Verde: .wikitable td:nth-child(2) x 22 @ Administrative_divisions_of_Cape_Verde",
	"Central African Republic: .wikitable td:nth-child(2) a x 17 @ Prefectures_of_the_Central_African_Republic",
	"Chad: p + div .wikitable td:nth-child(2) a x 23 @ Regions_of_Chad",
	"Chile: .wikitable td:nth-child(2) a x 16 @ Regions_of_Chile",
	"China: .wikitable td:nth-child(3) > a:first-child x 32 @ Provinces_of_China",
	"Colombia: .wikitable td:nth-child(2) a x 33 @ Departments_of_Colombia",
	"Comoros: p + h2 + ul li a x 4 @ List_of_islands_of_the_Comoros",
	"DR Congo: table + p + table td a:not(.image):not(.internal) x 26 @ Provinces_of_the_Democratic_Republic_of_the_Congo",
	"Congo: .wikitable td:first-child x 12 @ Departments_of_the_Republic_of_the_Congo",
	"Costa Rica: .wikitable td:nth-child(2) x 7 @ Provinces_of_Costa_Rica",
	"Ivory Coast: .wikitable th + td a x 14 @ Districts_of_Ivory_Coast",
	"Croatia: .hatnote + .wikitable tr th:first-child > a x 21 @ Counties_of_Croatia",
	"Cuba: h2 + p + ol li a x 16 @ Provinces_of_Cuba",
	"Cyprus: .wikitable td:first-child a x 6 @ Districts_of_Cyprus",
	"Czech Republic: .wikitable td:nth-child(2) a x 14 @ Regions_of_the_Czech_Republic",
	"Denmark: .floatright a x 5 @ Regions_of_Denmark",
	"Djibouti: .wikitable td:first-child x 6 @ Regions_of_Djibouti",
	"Dominica: .wikitable th:first-child a x 10 @ Parishes_of_Dominica",
	"Dominican Republic: .wikitable tr:not(:last-child) td:first-child x 32 @ Provinces_of_the_Dominican_Republic",
	"East Timor: .wikitable td:nth-child(2) a x 13 @ Municipalities_of_East_Timor",
	"Ecuador: .wikitable td:nth-child(2) a x 24 @ Provinces_of_Ecuador",
	"Egypt: .wikitable td:nth-child(2) a x 27 @ Governorates_of_Egypt",
	"El Salvador: .wikitable td:nth-child(3) a x 14 @ Departments_of_El_Salvador",
	"Equatorial Guinea: .wikitable td:nth-child(2) a x 8 @ Provinces_of_Equatorial_Guinea",
	"Eritrea: .wikitable td:first-child a x 6 @ Regions_of_Eritrea",
	"Estonia: .wikitable td:nth-child(2) a x 15 @ Counties_of_Estonia",
	"Eswatini: .wikitable td:nth-child(2) a x 4 @ Regions_of_Eswatini",
	"Ethiopia: .wikitable td:nth-child(3) a x 11 @ Regions_of_Ethiopia",
	"Fiji: h2 + table td[rowspan] a:first-child, h2 + table td[colspan] a:first-child x 5 @ Local_government_in_Fiji",
	"Finland: .wikitable td:nth-child(5) b x 19 @ Regions_of_Finland",
	"France: h2 + .wikitable td:nth-child(2) > a x 18 @ Regions_of_France",
	"Gabon: .wikitable td:nth-child(2) a x 9 @ Subdivisions_of_Gabon",
	"Gambia: .wikitable td:first-child a x 6 @ Subdivisions_of_the_Gambia",
	"Georgia: .infobox + .infobox td:nth-child(2) a x 12 @ Administrative_divisions_of_Georgia_(country)",
	"Germany: .wikitable td:nth-child(3) a x 16 @ States_of_Germany",
	"Ghana: .wikitable td:nth-child(2) a x 16 @ List_of_Ghanaian_regions_by_area",
	"Greece: .floatleft + p span + a x 8 @ Decentralized_administrations_of_Greece s/Decentralized Administration of (?:the )?|Autonomous Monastic State of /",
	"Grenada: .floatright ~ div:not(:last-child):not(:nth-last-child(2)) a x 7 @ Parishes_of_Grenada s/([a-z])([A-Z])/$1 $2",
	"Guatemala: .wikitable td:nth-child(3) a x 22 @ Departments_of_Guatemala",
	"Guinea: .wikitable td:first-child a x 8 @ Regions_of_Guinea",
	"Guinea-Bissau: .wikitable td:first-child a x 9 @ Regions_of_Guinea-Bissau",
	"Guyana: .wikitable td:nth-child(2) a x 10 @ Regions_of_Guyana",
	"Haiti: .wikitable td:nth-child(2) a x 10 @ Departments_of_Haiti",
	"Honduras: .wikitable td:nth-child(2) a x 18 @ Departments_of_Honduras",
	"Hungary: .wikitable tr:not(:last-child) th:first-child a x 20 @ Counties_of_Hungary",
	"Iceland: .wikitable td:first-child a x 72 @ Municipalities_of_Iceland",
	"India: .wikitable th:first-child a x 37 @ States_and_union_territories_of_India",
	"Indonesia: h3 + .wikitable td:nth-child(2) > a, h3 + .wikitable td:nth-child(2) > span a x 34 @ Provinces_of_Indonesia",
	"Iran: .wikitable tr:not(.sortbottom) td:first-child a x 31 @ Provinces_of_Iran",
	"Iraq: .wikitable td:first-child a x 19 @ Governorates_of_Iraq",
	"Ireland: .wikitable td:first-child a x 31 @ Local_government_in_the_Republic_of_Ireland s/(?:City)?(?: and )?(?:County)? Council/",
	"Israel: .mw-parser-output > h2 > span:first-child:not(#See_also):not(#Notes):not(#References):not(#External_links) x 7 @ Districts_of_Israel",
	"Italy: .timeline-wrapper + h2 + .wikitable td:nth-child(2) a x 20 @ Regions_of_Italy",
	"Jamaica: h2 + .wikitable td:nth-child(2) a x 14 @ Parishes_of_Jamaica",
	"Japan: dl + .wikitable td:first-child a x 47 @ Prefectures_of_Japan",
	"Jordan: .wikitable td:first-child:not(:empty) + td a x 12 @ Governorates_of_Jordan",
	"Kazakhstan: p + .wikitable td:nth-child(2) a x 18 @ Regions_of_Kazakhstan",
	"Kenya: h2 + p + .wikitable td:nth-child(2) a x 47 @ Counties_of_Kenya",
	"Kiribati: ol li a:first-child x 24 @ Subdivisions_of_Kiribati",
	"Kuwait: .wikitable tr:not(:last-child) td:first-child a x 6 @ Governorates_of_Kuwait s/Governorate/",
	"Kyrgyzstan: .wikitable td:nth-child(2) a x 9 @ Regions_of_Kyrgyzstan s/Region/",
	"Laos: .wikitable td:nth-child(2) a x 18 @ Provinces_of_Laos",
	"Latvia: .wikitable td:nth-child(2) a x 119 @ Administrative_divisions_of_Latvia",
	"Lebanon: .wikitable td:first-child a x 8 @ Governorates_of_Lebanon",
	"Lesotho: .wikitable td:nth-child(2) a x 10 @ Districts_of_Lesotho",
	"Liberia: .wikitable td:nth-child(2) a x 15 @ Counties_of_Liberia",
	"Libya: .wikitable td:nth-child(3) a x 22 @ Districts_of_Libya",
	"Liechtenstein: .wikitable tr:not(:last-child) td:nth-child(2) a x 11 @ Municipalities_of_Liechtenstein",
	"Lithuania: .wikitable tr:not(:last-child) td:nth-child(2) > a:first-child x 10 @ Counties_of_Lithuania",
	"Luxembourg: .multicol ul ul li a x 12 @ Cantons_of_Luxembourg",
	"Madagascar: .wikitable td:nth-child(2) > a x 22 @ Regions_of_Madagascar",
	"Malawi: .mw-parser-output li span + a x 3 @ Regions_of_Malawi",
	"Malaysia: .wikitable td:nth-child(3) a x 16 @ States_and_federal_territories_of_Malaysia",
	"Maldives: .wikitable td:nth-child(6) x 21 @ Administrative_divisions_of_the_Maldives",
	"Mali: .wikitable td:first-child x 11 @ Regions_of_Mali",
	"Malta: h3 + .wikitable td:nth-child(2) a x 5 @ Regions_of_Malta",
	"Marshall Islands: .toc + h2 + p + .wikitable td:first-child > a x 24 @ List_of_islands_of_the_Marshall_Islands",
	"Mauritania: .wikitable td:nth-child(2) a x 15 @ Regions_of_Mauritania",
	"Mexico: .wikitable td:first-child a x 32 @ List_of_states_of_Mexico",
	"Micronesia: .wikitable td:nth-child(2) a x 4 @ States_of_the_Federated_States_of_Micronesia",
	"Moldova: p + ul + .wikitable td:first-child a x 32 @ Administrative_divisions_of_Moldova",
	"Monaco: Monaco",
	"Mongolia: .wikitable td:first-child a x 22 @ Provinces_of_Mongolia",
	"Montenegro: .wikitable td:nth-child(3) a x 24 @ Municipalities_of_Montenegro",
	"Morocco: .toc + h2 + p + .wikitable td:nth-child(3) > a x 12 @ Regions_of_Morocco",
	"Mozambique: .wikitable td:nth-child(2) a x 11 @ Provinces_of_Mozambique",
	"Myanmar: .wikitable td:nth-child(2) a, .wikitable td:first-child a:not(.image) x 21 @ Administrative_divisions_of_Myanmar",
	"Namibia: .wikitable td:nth-child(2) a x 14 @ Regions_of_Namibia",
	"Nauru: .wikitable td:nth-child(2) a x 14 @ Nauru",
	"Nepal: .wikitable td:first-child a x 7 @ Provinces_of_Nepal",
	"Netherlands: .wikitable th:first-child span + a x 12 @ Provinces_of_the_Netherlands",
	"New Zealand: .wikitable td:nth-child(2) a x 16 @ Regions_of_New_Zealand",
	"Nicaragua: .wikitable td:nth-child(3) a x 17 @ Departments_of_Nicaragua",
	"Niger: .wikitable td:first-child a x 8 @ Regions_of_Niger",
	"Nigeria: table ol li a, table[align=right] td a x 37 @ States_of_Nigeria",
	"North Korea: .wikitable td:first-child a x 9 @ Provinces_of_North_Korea",
	"North Macedonia: .wikitable td:first-child a x 8 @ Statistical_regions_of_North_Macedonia",
	"Norway: .wikitable td:nth-child(2) > a x 18 @ Counties_of_Norway",
	"Oman: .wikitable td:first-child a x 11 @ Governorates_of_Oman",
	"Pakistan: .wikitable tr:not(.sortbottom) td:first-child > a x 7 @ Administrative_units_of_Pakistan",
	"Palau: .wikitable td:first-child .image + a x 16 @ States_of_Palau",
	"Palestine: .thumb + .wikitable td:first-child a x 16 @ Governorates_of_Palestine",
	"Panama: h2 + .wikitable td:first-child a, h2 + h3 + .wikitable td:first-child a x 13 @ Provinces_of_Panama",
	"Papua New Guinea: .wikitable td:nth-child(3) .image + a x 22 @ Provinces_of_Papua_New_Guinea",
	"Paraguay: .wikitable tr:not(:last-child) td:nth-child(2) .image + a, .wikitable tr:nth-child(2) td:nth-child(3) a x 18 @ Departments_of_Paraguay",
	"Peru: .wikitable td:first-child a x 25 @ Regional_circumscriptions_of_Peru",
	"Philippines: .wikitable td:nth-child(2) > a x 17 @ Regions_of_the_Philippines",
	"Poland: .wikitable td:nth-child(6) a x 16 @ Voivodeships_of_Poland",
	"Portugal: .wikitable td:first-child a x 18 @ Districts_of_Portugal",
	"Qatar: .wikitable td:nth-child(2) a x 8 @ Municipalities_of_Qatar",
	"Romania: .wikitable tr > *:first-child a:not(.image) x 42 @ Counties_of_Romania",
	"Russia: .thumb + .wikitable td:nth-child(2) > a x 85 @ Federal_subjects_of_Russia",
	"Rwanda: .wikitable td:first-child a x 5 @ Provinces_of_Rwanda",
	"Saint Kitts and Nevis: table ol li a:first-child x 14 @ Saint_Kitts_and_Nevis",
	"Saint Lucia: .toc + h2 + .wikitable td:nth-child(2) a x 11 @ Quarters_of_Saint_Lucia",
	"Saint Vincent and the Grenadines: .wikitable td:first-child a x 6 @ Parishes_of_Saint_Vincent_and_the_Grenadines",
	"Samoa: .wikitable tr:not(:nth-last-child(5)) td:nth-child(2) a x 11 @ Districts_of_Samoa",
	"San Marino: .wikitable td:first-child .image + a x 9 @ Municipalities_of_San_Marino",
	"São Tomé and Príncipe: .wikitable td:nth-child(2) a x 7 @ Districts_of_São_Tomé_and_Príncipe",
	"Saudi Arabia: .wikitable td:first-child:not([colspan]) a x 13 @ Regions_of_Saudi_Arabia",
	"Senegal: .wikitable td:first-child a x 14 @ Regions_of_Senegal",
	"Serbia: .wikitable td:first-child a:first-child x 29 @ Districts_of_Serbia, Belgrade",
	"Seychelles: .wikitable td:nth-child(2) > a x 30 @ Districts_of_Seychelles",
	"Sierra Leone: .toc + h2 + ul li a x 4 @ Provinces_of_Sierra_Leone",
	"Singapore: .toc + h2 + p + ul li a x 5 @ Community_Development_Council",
	"Slovakia: .wikitable td:nth-child(3) a x 8 @ Regions_of_Slovakia",
	"Slovenia: .wikitable td:nth-child(2) a x 212 @ Municipalities_of_Slovenia",
	"Solomon Islands: .wikitable tr:not(:nth-last-child(2)) td:nth-child(2) > a, .wikitable tr:nth-last-child(2) td:nth-child(3) > a x 10 @ Provinces_of_Solomon_Islands",
	"Somalia: .wikitable td:first-child > a x 18 @ Administrative_divisions_of_Somalia",
	"South Africa: p + h2 + .wikitable td:first-child > a x 9 @ Provinces_of_South_Africa",
	"South Korea: .wikitable b x 9 @ Provinces_of_South_Korea",
	"South Sudan: .wikitable td:first-child a:not(.image) x 32 @ States_of_South_Sudan",
	"Spain: h2 + .wikitable td:nth-child(2) a, h3 + .wikitable td:nth-child(3) a x 19 @ Autonomous_communities_of_Spain",
	"Sri Lanka: .wikitable td:first-child .flagicon + a x 9 @ Provinces_of_Sri_Lanka",
	"Sudan: ol + ul a x 18 @ States_of_Sudan s/\\\\(state\\\\)/",
	"Suriname: .wikitable td:nth-child(2) a x 10 @ Districts_of_Suriname",
	"Sweden: .wikitable td:nth-child(5) a x 21 @ Counties_of_Sweden",
	"Switzerland: .wikitable td + th:nth-child(3) a:first-child x 26 @ Cantons_of_Switzerland",
	"Syria: h2 + .wikitable td:first-child a x 14 @ Governorates_of_Syria s/Governorate/",
	"Tajikistan: .wikitable td:nth-child(2) a x 5 @ Regions_of_Tajikistan",
	"Tanzania: .wikitable td:first-child a x 31 @ Regions_of_Tanzania s/Region/",
	"Thailand: .wikitable td:nth-child(2) .flagicon + a x 77 @ Provinces_of_Thailand",
	"Togo: .wikitable td:first-child a x 5 @ Regions_of_Togo",
	"Tonga: .toc + h2 + .wikitable tr:not(:last-child) td:first-child a x 5 @ Administrative_divisions_of_Tonga",
	"Trinidad and Tobago: .wikitable td:first-child a x 14 @ Regional_corporations_and_municipalities_of_Trinidad_and_Tobago",
	"Tunisia: .wikitable td:nth-child(2) a x 24 @ Governorates_of_Tunisia",
	"Turkey: .toc + h2 + p + .wikitable td:nth-child(2) a x 81 @ Provinces_of_Turkey",
	"Turkmenistan: .wikitable th:first-child a x 6 @ Regions_of_Turkmenistan",
	"Tuvalu: .wikitable tr:not(:nth-last-child(2)) td:first-child:not([colspan]) a x 9 @ List_of_islands_of_Tuvalu",
	"Uganda: .wikitable td a x 128 @ Districts_of_Uganda",
	"Ukraine: .hatnote + p + p + .wikitable td:first-child a, .hatnote + p + .wikitable td:first-child a x 27 @ Administrative_divisions_of_Ukraine",
	"United Arab Emirates: .wikitable td:nth-child(2) a x 7 @ Emirates_of_the_United_Arab_Emirates",
	"United Kingdom: .wikitable td:first-child > a x 48 @ Ceremonial_counties_of_England, .wikitable td:first-child a x 6 @ Counties_of_Northern_Ireland, h3 + ul + .wikitable td:nth-child(2) a x 32 @ Subdivisions_of_Scotland, .wikitable td:first-child a x 18 @ History_of_local_government_in_Wales",
	"United States: .wikitable th:first-child .flagicon + a x 56 @ List_of_states_and_territories_of_the_United_States",
	"Uruguay: .wikitable td:nth-child(2) a x 19 @ Departments_of_Uruguay",
	"Uzbekistan: .wikitable th:first-child a x 14 @ Regions_of_Uzbekistan",
	"Vanuatu: .mw-parser-output table + p + .wikitable tr:not(.sortbottom) td:first-child a x 6 @ Provinces_of_Vanuatu",
	"Vatican City: Vatican City",
	"Venezuela: .hatnote + .wikitable td:nth-child(2) a, h2 + .wikitable td:nth-child(3) a x 25 @ States_of_Venezuela",
	"Vietnam: p + p + .wikitable td:first-child a x 63 @ Provinces_of_Vietnam",
	"Yemen: .wikitable td:first-child:not([colspan]) a x 22 @ Governorates_of_Yemen",
	"Zambia: h2 + .wikitable td:first-child > a x 10 @ Provinces_of_Zambia",
	"Zimbabwe: h2 + .wikitable th:first-child a x 10 @ Provinces_of_Zimbabwe",
	"Taiwan: .hatnote + p + .wikitable td:first-child > a x 6 @ Special_municipality_(Taiwan)",
	"Kosovo: .wikitable td:first-child > a x 7 @ Districts_of_Kosovo",
	"Northern Cyprus: .wikitable td:first-child a x 6 @ Districts_of_Northern_Cyprus",
	"Transnistria: .mw-parser-output ul li a x 6 @ Administrative_divisions_of_Transnistria"
];

async function getSubdivisions(queryStr, verbose = false) {
	const splitRegex = /([\w\s]+)\s*:\s*(.+)/,
		queryRegex = /(?:(.+?)\s*(?:x\s*(\d+))?\s*@\s*(.+?)\s*(?:s\/((?:\\.|[^\/])+?)\/(.*?))?|\s*(.+?))\s*(?:,|$)/g,
		subdivisions = [],
		start = performance.now();

	const [
		_,
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
	return out;
}

export {
	getSubdivisions,
	collect
};
