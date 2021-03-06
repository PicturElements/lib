import VueAdmin from "@qtxr/vue-admin";
import viewMap from "./runtime/gen/view-map";

const admin = new VueAdmin(viewMap, {
	// global config goes here
	appearance: {
		general: {
			breadcrumbs: true,
			sidebar: true
		},
		login: {
			credit: true
		}
	},
	behavior: {
		routing: {
			sidebar: {
				preExpand: true
			}
		}
	},
	dev: {
		suppressWarnings: false
	}
});

// ====== ROUTES ======
// Route your app here. Use indentation to nest routes
// A route prefixed with a forward slash is treated as
// a base route nested in its parent view (accessible via router-view),
// while a route not prefixed with one is treated as its own view,
// but nested within the closest base route
admin.route(`
<%- routesTemplate %>
`);

// ====== DEPENDENCY INJECTION ======
/*
*	Common dependencies
*	vuex:	Add Vuex store to enable global state management within the admin app
*			Internally, this dependency will be saved as "store"
*
*			Usage:
*			admin.supply("vuex")(storeOrVuex, partitionPath?, storageName?), where
*			* storeOrVuex is a Vuex.Store instance or the Vuex singleton. If Vuex is passed,
*			  it will also automatically be used as a plugin
*			* partitionPath is the optional path to the store partition allotted for VueAdmin.
*			  Default is "admin"
*			* storageName is the name used to set state to local/session storage
*
*
*	Abstract dependency usage:
*	admin
*		.autoSupply()				// Supply all built-in dependencies without initializers
*		.supply("dep")				// Supply built-in dependency without initializer
*		.supply("dep")(Dep)			// Supply built-in dependency with initializer and provide init arguments
*		.supply("dep", { ... })		// Supply custom dependency without initializer directly
*		.supply("dep", {			// Supply custom dependency with initializer and provide init arguments
*			init(Dep) {
*				// init code
*			}
*		})(Dep)
*/

admin
	.autoSupply();

// ====== COMPONENT WRAPPING ======
/*
*	VueAdmin uses @qtxr/vue-wrap-component to enhance the Vue API. Supply assets below
*
*
*	Abstract supplier usage:
*	admin.wrapperManager
*		.autoSupply()				// Supply all built-in features without initializers
*		.supply("dep")				// Supply built-in feature without initializer
*		.supply("dep")(Dep)			// Supply built-in feature with initializer and provide init arguments
*		.supply("dep", { ... })		// Supply custom feature without initializer directly
*		.supply("dep", {			// Supply custom feature with initializer and provide init arguments
*			init(Dep) {
*				// init code
*			}
*		})(Dep)
*/

admin.wrapperManager
	.autoSupply();

// ====== STORES ======
/*
*	Set up stores here. Requires a "store" interface dependency to work
*
*	Usage:
*	admin[store | sessionStore | localStore](path?, store), where
*	* path is a Vuex-like path (a/b/c)
*	* store is a Vuex-like store configuration object
*
*	The default names and resulting paths for the store types are:
*	* store:		""			path: <partitionPath>
*	* sessionStore:	"session"	path: <partitionPath>/session
*	* localStore:	"local"		path: <partitionPath>/local
*/

// Example of a sessionStorage bound store module
/*
admin.sessionStore({
	state: {
		// in session/local stores, this is the default
		// state given to the store. Otherwise, the last saved state
		// will be fetched from storage when the app is first
		// loaded. New default state will be merged with existing
		// state upon load
		loggedIn: false,
		user: null
	},
	mutations: {
		login(state) {
			state.loggedIn = true;
		},
		logout(state) {
			state.loggedIn = false;
		}
	}
});
*/

export default admin;
