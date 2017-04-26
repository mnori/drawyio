// Dialog classes //////////////////////////////////////////////////////////////

function ModDialog(entityType, entityID, processCallback) {
	this.entityType = entityType;
	this.entityID = entityID;
	this.processCallback = (processCallback) ? processCallback : null;
	var self = this;
	this.init = function() {
		this.setup();
	}

	this.setup = function() {
		$("#mod_dialog").dialog({
			resizable: false,
			// height: 582,
			width: 400,
			modal: true,
			draggable: false,
			autoOpen: false,
			closeOnEscape: false,
			open: function(event, ui) {
				modalOpenSetup();
				self.configureRadios();
		    }
		});

		// Set up OK button event handler
		$("#mod_ok").click(function() {
			self.process();
			$("#mod_dialog").dialog("close");
		});

		$("#mod_cancel").click(function() {
			$("#mod_dialog").dialog("close");
		});
	}

	this.configureRadios = function() {
		configureRadio(
			"mod_visibility", opts["isPrivate"] ? "mod_visibility_private" : null
		);
		configureRadio(
			"mod_deleted", opts["isDeleted"] ? "mod_deleted_yes" : null
		);

		if (typeof(opts["isStaffPick"]) === "undefined") {
			// staff pick is hidden for room
			$("#mod_staff_pick_container").hide();
		} else {
			$("#mod_staff_pick_container").show();
			configureRadio(
				"mod_staffpick", opts["isStaffPick"] ? "mod_staffpick_yes" : null
			);
		}
	}

	this.process = function() {
		var isPrivate = (getRadio("mod_visibility") == "mod_visibility_private");
		var isDeleted = (getRadio("mod_deleted") == "mod_deleted_yes");
		var isStaffPick = (getRadio("mod_staffpick") == "mod_staffpick_yes");

		$.ajax({
			url: "/ajax/moderate", 
			data: {
				"id": self.entityID,
				"type": self.entityType,
				"isPrivate": isPrivate ? 1 : 0,
				"isDeleted": isDeleted ? 1 : 0,
				"isStaffPick": isStaffPick ? 1 : 0,

			}
		}).done(function(response) {
			if (!processError(response)) {
				if (this.processCallback) {
					// set response stuff into the drawUI using some callback
					this.processCallback(response);
				}
				infoDialog.show("Settings applied.");	
			}
		});
	}

	this.show = function(snapshotIDIn) {
		$("#mod_dialog").dialog("open");
	}

	this.init();
}

// simple helper for setting up jqueryui radio buttons
function configureRadio(elClass, checkedID) {
	$("."+elClass).checkboxradio();
	if (checkedID) {
		$("#"+checkedID).attr("checked", "checked");
	} else {
		$("."+elClass+":first").attr("checked", "checked");	
	}
	
	$("."+elClass).checkboxradio("refresh");				
}

// Get ID of selected radio element
function getRadio(elClass) {
	var idOut = $("input[type='radio']:checked."+elClass).attr("id");
	return idOut
}

function NickDialog() {
	// Set up a modal asking about setting the nickname
	var self = this;
	function init() {
		setup();

		// the style changes based on the user type
		// TODO put this in a function
		receiveSessionData(conf["sessionData"]);
	}

	// Set up modal dialogue for changing the nickname
	function setup() {
		// Create modal using jqueryui
		$("#nick_dialog").dialog({
			resizable: false,
			width: 400,
			modal: true,
			draggable: false,
			autoOpen: false,
			closeOnEscape: false,
			open: function(event, ui) {
		        modalOpenSetup();
				$("#nick_input").select();
				$("#nick_dialog").show();
		    }
		});

		// Make text input highlight when clicked
		$("#nick_input").click(function() { $(this).select(); })

		// Set up OK button event handler
		$("#nick_ok").click(function() {
			var nick = $("#nick_input").val();
			$.ajax({
				url: "/ajax/set_session_name", 
				data: {"name": nick}
			}).done(function(response) {
				// !! can be error if username is taken
				var handleClose = function() { // Close button OK click event handler
					nickDialog.show();
				}
				$("#nick_dialog").dialog("close");
				if (!processError(response, handleClose)) { // success
					receiveSessionData(response);
					registerDialog.show();
				}
			});
		})

		$("#nick_cancel").click(function() {
			$("#nick_dialog").dialog("close");
		});

		$("#nick_login").click(function() {
			$("#nick_dialog").dialog("close");
			$("#login_dialog").dialog("open");
		})
	}

	this.show = function() {
		$("#nick_input").val(conf["sessionData"]["name"]);
		$("#nick_dialog").dialog("open");
	}
	init();
	return this;
}

function AccountDialog() {
	var self = this;
	function init() {
		setup();
	}

	function setup() {
		$("#account_dialog").dialog({
			resizable: false,
			// height: 582,
			width: 400,
			modal: true,
			draggable: false,
			autoOpen: false,
			closeOnEscape: false,
			open: function(event, ui) {
				insertSessionName("account_dialog_name", conf["sessionData"]);
				modalOpenSetup();
		    }
		});
		$("#account_change_pw").click(function() {
			$("#account_dialog").dialog("close");
			changePwDialog.show();
		});
		// Set up OK button event handler
		$("#account_logout").click(function() {
			$.ajax({url: "/ajax/logout"}).done(function(response) {
				$("#account_dialog").dialog("close");
				var handleClose = function() {
					accountDialog.show();
				}
				if (!processError(response, handleClose)) { // success
					// update the sessionData coming back from the client
					receiveSessionData(response);
										
					$("#account_dialog").dialog("close");
					infoDialog.show("You are now logged out.");
				}
			});
		});
		$("#account_continue").click(function() {
			$("#account_dialog").dialog("close");
		});
	}

	this.show = function() {
		$("#account_dialog").dialog("open");
	}
	init();
	return this;
}

function ChangePwDialog() {
	function init() {
		setup();
	}

	function setup() {
		$("#change_pw_dialog").dialog({
			resizable: false,
			// height: 582,
			width: 400,
			modal: true,
			draggable: false,
			autoOpen: false,
			closeOnEscape: false,
			open: function(event, ui) {
				modalOpenSetup();
		    }
		});

		$("#change_pw_cancel").click(function() {
			$("#change_pw_dialog").dialog("close");
		});

		$("#change_pw_submit").click(function() {
			$.ajax({
				url: "/ajax/changepw", 
				data: {
					"pwCurr": $("#change_pw_curr").val(),
					"pw1": $("#change_pw1").val(),
					"pw2": $("#change_pw2").val()
				}
			}).done(function(response) {
				$("#change_pw_dialog").dialog("close");
				var handleClose = function() { // Close button OK click event handler
					changePwDialog.show();
				}
				if (!processError(response, handleClose)) { // success
					infoDialog.show("Password changed successfully.")
				};
			});
		});
	}

	this.show = function() {
		$("#change_pw_curr").val("");
		$("#change_pw1").val("");
		$("#change_pw2").val("");
		$("#change_pw_dialog").dialog("open");

	}

	init();
	return this;
}

function LoginDialog() {
	// Set up a modal asking about setting the nickname
	var self = this;
	function init() {
		setup();
	}

	// Set up modal dialogue for changing the nickname
	function setup() {
		// Create modal using jqueryui
		$("#login_dialog").dialog({
			resizable: false,
			width: 400,
			modal: true,
			draggable: false,
			autoOpen: false,
			closeOnEscape: false,
			open: function(event, ui) {
				modalOpenSetup();
				$("#login_dialog").show();
				$("#login_username").val("");
				$("#login_password").val("");
		    }
		});

		$("#login_back").click(function() {
			$("#login_dialog").dialog("close");
			nickDialog.show();
		});

		$("#login_cancel").click(function() {
			$("#login_dialog").dialog("close");
		});

		$("#login_submit").click(function() {
			$.ajax({
				url: "/ajax/login", 
				data: {
					"username": $("#login_username").val(),
					"password": $("#login_password").val(),
				}
			}).done(function(response) {
				$("#login_dialog").dialog("close");
				var handleClose = function() {
					loginDialog.show();
				}
				if (!processError(response, handleClose)) { // success
					receiveSessionData(response);
					$("#login_dialog").dialog("close");
					infoDialog.show("You are now logged in.");
				}
			});
		})
	}

	this.show = function(rename) {
		$("#login_dialog").dialog("open");
	}
	init();
	return this;
}

function RegisterDialog() {

	var self = this;
	function init() {
		setup();
	}

	function setup() {
		$("#register_dialog").dialog({
			resizable: false,
			// height: 582,
			width: 400,
			modal: true,
			draggable: false,
			autoOpen: false,
			closeOnEscape: false,
			open: function(event, ui) {
				modalOpenSetup();
		    }
		});

		$("#register_back").click(function() {
			$("#register_dialog").dialog("close");
			nickDialog.show();
		});

		$("#register_skip").click(function() {
			$("#register_dialog").dialog("close");
		});

		$("#register_ok").click(function() {
			// Register the user
			$.ajax({
				url: "/ajax/register", 
				data: {
					"pw1": $("#register_pw1").val(),
					"pw2": $("#register_pw2").val(),
					"g-recaptcha-response": grecaptcha.getResponse(self.grWidgetID)
				}
			}).done(function(response) {
				$("#register_dialog").dialog("close");
				var handleClose = function() { // Close button OK click event handler
					registerDialog.show();
				}
				if (!processError(response, handleClose)) { // success
					receiveSessionData(JSON.parse(response));
					infoDialog.show("Registration successful, you are now logged in.");
				}
			});
		});
	}

	this.show = function() {
		$("#register_dialog").dialog("open");
		renderCaptcha(self, "register_captcha");
	}

	init();
	return self;
}

function GalleriesDialog() {
	var self = this;
	function init() {
		setup();
	}

	function setup() {
		$("#galleries_dialog").dialog({
			resizable: false,
			// height: 582,
			width: 400,
			modal: true,
			draggable: false,
			autoOpen: false,
			closeOnEscape: false,
			open: function(event, ui) {
				modalOpenSetup();
		    }
		});
		// Set up OK button event handler
		$("#galleries_cancel").click(function() {
			$("#galleries_dialog").dialog("close");
		});
		$("#galleries_ok").click(function() {
			window.location.href = "/gallery/rooms";
		});
		$("#galleries_btn").click(self.show);
	}

	this.show = function() {
		$("#galleries_dialog").dialog("open");
	}
	init();
	return this;
}

function ErrorDialog() {
	function init() {
		setup();
	}

	function setup() {
		$("#error_dialog").dialog({
			resizable: false,
			// height: 582,
			width: 400,
			modal: true,
			draggable: false,
			autoOpen: false,
			closeOnEscape: false,
			open: function(event, ui) {
				modalOpenSetup();
		    }
		});
	}

	this.show = function(errorMessageIn, okCallback) {
		var titleHtml = "<i class=\"fa fa-times button_icon\" aria-hidden=\"true\"></i>Error"
		$("#error_dialog").prev().find(".ui-dialog-title").html(titleHtml);

		var ok = $("#error_button");
		// Set up OK button event handler
		ok.off(); // remove any event handlers
		ok.click(function() {
			$("#error_dialog").dialog("close");
			if (okCallback) {
				okCallback(); // do custom thing after user closes error dialog
			}
		});

		errorMessage = "Unknown error."
		if (errorMessageIn) {
			errorMessage = errorMessageIn;
		}
		$("#error_message").html(errorMessage)
		$("#error_dialog").dialog("open");

	}
	init();
	return this;
}

function InfoDialog() {
	function init() {
		setup();
	}

	function setup() {
		$("#info_dialog").dialog({
			resizable: false,
			// height: 582,
			width: 400,
			modal: true,
			draggable: false,
			autoOpen: false,
			closeOnEscape: false,
			open: function(event, ui) {
				modalOpenSetup();
		    }
		});
	}

	this.show = function(messageIn) {
		var titleHtml = "<i class=\"fa fa-info button_icon\" aria-hidden=\"true\"></i>Info"
		$("#info_dialog").prev().find(".ui-dialog-title").html(titleHtml);

		var ok = $("#info_button");
		// Set up OK button event handler
		ok.off(); // remove any event handlers
		ok.click(function() {
			$("#info_dialog").dialog("close");
		});
		$("#info_message").html(messageIn)
		$("#info_dialog").dialog("open");
	}
	init();
	return this;
}

function RoomDialog(roomIDIn) {
	var snapshotID = null;
	var roomID = roomIDIn;
	var self = this;
	function init() {
		setup();
		$("#create_drawing_btn").click(function() { 
			setTitle("Create new room");
			self.show(); 
		});

		// is there a snapshot button?
		var snapshotButton = $("#create_snapshot_room");
		if (snapshotButton.length == 1) {
			snapshotButton.click(function() {
				setTitle("Create new room from image");
				self.show(roomIDIn);
			});
		}
	}

	function setTitle(value) {
		$("#room_dialog").prev().find(".ui-dialog-title").text(value);
	}

	function setup() {
		$("#room_dialog").dialog({
			resizable: false,
			// height: 582,
			width: 400,
			modal: true,
			draggable: false,
			autoOpen: false,
			closeOnEscape: false,
			open: function(event, ui) {
				modalOpenSetup();

				// Set up radio buttons 
				$(".room_visibility").checkboxradio();

				$(".room_visibility:first").attr("checked", "checked");
				$(".room_visibility").checkboxradio("refresh");				
				$(".room_visibility").change(function() {
					var value = $(this).attr("id");
					if (value == "room_visibility_public") {
						$("#room_public_info").show();
						$("#room_private_info").hide();
					} else {
						$("#room_public_info").hide();
						$("#room_private_info").show();
					}
				})
				$("#nick_dialog").show();
		    }
		});
		// Make text input highlight when clicked
		$("#room_name_input").click(function() { $(this).select(); })
		$("#room_name_input").select();

		// Set up OK button event handler
		$("#room_ok").click(function() {
			process();
			$("#room_dialog").dialog("close");
		});

		$("#room_cancel").click(function() {
			$("#room_dialog").dialog("close");
		});
	}
	function process() {
		var roomName = $("#room_name_input").val();

		var visibility = $("input[type='radio']:checked.room_visibility").attr("id");
		var isPrivate = (visibility == "room_visibility_private") ? true : false;

		var params = {
			"name": roomName,
			"isPrivate": isPrivate,
			"g-recaptcha-response": grecaptcha.getResponse(self.grWidgetID)
		}
		if (snapshotID != null) {
			params["snapshotID"] = snapshotID;
		}

		$.ajax({
			url: "/ajax/create_room", 
			data: params
		}).done(function(response) {
			var handleClose = function() { // Close button OK click event handler
				self.show();
			}
			$("#room_dialog").dialog("close");
			if (!processError(response, handleClose)) {
				// Redirect to the snapshot's page
				window.location.href = "/r/"+response;
			}
		});
	}

	this.show = function(snapshotIDIn) {
		renderCaptcha(self, "room_captcha");
		if (typeof(snapshotIDIn) !== "undefined") {
			snapshotID = snapshotIDIn;
		} else {
			snapshotID = null;
		}

		if (snapshotID) { // if snapshot, we must pass the name through
			var el = $("#snapshot_title");
			var txt = el.text();

			// TODO load from settings file - must pass from server to client
			if (txt == "An unnamed snapshot") {
				txt = "An unnamed room";
			}
			$("#room_name_input").val(txt);
			$("#room_name_input").select();
		} else {
			$("#room_name_input").val("An unnamed room");
			$("#room_name_input").select();
		}
		$("#room_dialog").dialog("open");
	}

	init();
}

function SnapshotDialog(roomIDIn) {
	var self = this;
	var roomID = roomIDIn;
	function init() {
		$("#snapshot").click(self.show);
		setup();
	}

	function setup() {
		$("#snapshot_dialog").dialog({
			resizable: false,
			// height: 382,
			width: 400,
			modal: true,
			draggable: false,
			autoOpen: false,
			closeOnEscape: false,
			open: function(event, ui) {
				modalOpenSetup();

				// Set up radio buttons 
				$(".snapshot_visibility").checkboxradio();

				$(".snapshot_visibility:first").attr("checked", "checked");
				$(".snapshot_visibility").checkboxradio("refresh");				
				$(".snapshot_visibility").change(function() {
					var value = $(this).attr("id");
					if (value == "snapshot_visibility_public") {
						$("#snapshot_public_info").show();
						$("#snapshot_private_info").hide();
					} else {
						$("#snapshot_public_info").hide();
						$("#snapshot_private_info").show();
					}
				})

				$("#nick_dialog").show();
		    }
		});
		// Make text input highlight when clicked
		$("#snapshot_name_input").click(function() { $(this).select(); })
		$("#snapshot_name_input").select();

		// Set up OK button event handler
		$("#snapshot_ok").click(function() {
			process();
			$("#snapshot_dialog").dialog("close");
		});

		$("#snapshot_cancel").click(function() {
			$("#snapshot_dialog").dialog("close");
		});
	}
	function process() {
		var snapshotName = $("#snapshot_name_input").val();
		var visibility = $("input[type='radio']:checked.snapshot_visibility").attr("id");
		var isPrivate = (visibility == "snapshot_visibility_private") ? true : false;

		$.ajax({
			url: "/ajax/create_snapshot", 
			data: {
				roomID: roomID,
				name: snapshotName,
				isPrivate: isPrivate,
				"g-recaptcha-response": grecaptcha.getResponse(self.grWidgetID)
			}
		}).done(function(response) {
			if (!processError(response)) {
				// Redirect to the snapshot's page
				window.location.href = "/s/"+response;
			}
		});
	}

	this.show = function(rename) {
		$("#snapshot_dialog").dialog("open");
		renderCaptcha(self, "snapshot_captcha");
	}

	init();
}