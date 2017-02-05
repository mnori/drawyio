
function initSplash() {
	$("#create_drawing_btn").click(function() {
		// Send ajax request for new drawing ID
		$.ajax({
			url: "/create_drawing"

		}).done(function(drawingID) {
			window.location.href = "/drawings/"+drawingID
		});
	});
}