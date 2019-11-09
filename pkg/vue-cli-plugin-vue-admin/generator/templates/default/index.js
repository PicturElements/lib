import "./setup";
import admin from "./admin";
import components from "./runtime/gen/components";

admin.prepare({
	components
});

export default admin;
