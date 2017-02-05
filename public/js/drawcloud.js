
function initSplash() {
	$("#create_drawing_btn").click(function() {
		// Send ajax request for new drawing ID
		$.ajax({
			url: "/create_drawing"

		}).done(function(drawingID) {
			alert(drawingID)
			// // TODO sort out this mess
			// $("#help").show()
			// $("#search").hide()
			// $("#d3nome").hide();
			// $("#help").html(html);
			// $("#transcript-data").empty();
			// this.hideLoading();
			// this.initHelpLinks();
		});
	});
}