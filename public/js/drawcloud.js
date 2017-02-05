// drawcloud.js (c) Matthew Norris 2017

function initSplash() {
	$("#create_drawing_btn").click(function() {
		// Send ajax request for new drawing ID
		$.ajax({
			url: "/create_drawing"

		}).done(function(drawingID) {
			// Redirect to the drawing's page
			window.location.href = "/drawings/"+drawingID
		});
	});
}