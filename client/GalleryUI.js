function GalleryUI(type) {
	var self = this;
	var init = function(type) {

		// select particular radio buttons
		if (type == "room") {
			$("#gallery_type_room").attr("checked", "checked");
		} else {
			$("#gallery_type_snapshot").attr("checked", "checked");
		}
		$("#gallery_public").attr("checked", "checked");
		$("#gallery_not_deleted").attr("checked", "checked");
	
		// initialise
		$(".gallery_opts").checkboxradio();

		// attach change event handler
		$(".gallery_opts").change(this.requestGallery);

		listenMore();
	}

	// Fetches gallery data using ajax
	this.requestGallery = function() {
		// Handle the type - room | snapshot
		var type = (getRadio("gallery_type") == "gallery_type_snapshot") 
			? "snapshot" : "room";
		var title = type == "snapshot" ? "Snapshots" : "Rooms";
		title = "DrawIO - "+title;
		window.history.pushState(
			"new type", title, "/gallery/"+type+"s");
		document.title = title;

		// Get visibility
		var isPrivate = (getRadio("gallery_visibility") == "gallery_private")
			? true : false;;

		// Get deleted
		var isDeleted = (getRadio("gallery_deleted") == "gallery_deleted")
			? true : false;

		$.ajax({
			url: "/ajax/gallery/"+type+"s", 
			data: {
				"isPrivate": isPrivate,
				"isDeleted": isDeleted
			}
		}).done(function(html) {
			$("#gallery").html(html);
			listenMore();
		});
	}

	// Listen to the "load more" button
	var listenMore = function() {
		var more = $("#gallery_more");
		if (more.length == 0) {
			return;
		}
		$("#gallery_more").click(function() {

			// Fetch more gallery data using ajax
			var checkedID = $("input[type='radio']:checked.gallery_type").attr("id");
			var type = (checkedID == "galleries_snapshots") ? "snapshot" : "room";
			var oldest = findOldestUnixtime();

			// Get visibility
			var isPrivate = (getRadio("gallery_visibility") == "gallery_private")
				? true : false;;

			// Get deleted
			var isDeleted = (getRadio("gallery_deleted") == "gallery_deleted")
				? true : false;

			var data = {
				"oldestTime": ""+oldest,
				"isPrivate": isPrivate,
				"isDeleted": isDeleted
			}
			$.ajax({
				url: "/ajax/gallery/"+type+"s", 
				data: data
			}).done(function(html) {
				$("#gallery_more_container").replaceWith(html);
				listenMore(); // listen to newly created load more button
			});
		});
	}

	var findOldestUnixtime = function() {
		var oldest = null;
		$(".thumb_ago").each(function() {
			var thisVal = parseInt($(this).data("unixtime"));
			if (oldest == null || thisVal < oldest) {
				oldest = thisVal;
			}
		});
		return oldest;
	}

	init(type);
}