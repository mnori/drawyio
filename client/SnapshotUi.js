function SnapshotUi() {
	var modDialog = new ModDialog("snapshot", opts["snapshotID"]);
	$("#mod_button").click(function() {
		modDialog.show();
	});
}