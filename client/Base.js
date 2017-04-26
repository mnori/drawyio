// The non-minified draw.io front end client
// (C) 2017 drawy.io

// GLOBAL ///////////////////////////////////////////////////////////////////////////////

function Base(conf) {
	this.conf = conf;

	this.init = function() {
		var snapID = (typeof(opts) !== "undefined") ? opts["snapshotID"] : null;
		roomDialog = new RoomDialog(snapID);
		errorDialog = new ErrorDialog();
		infoDialog = new InfoDialog();
		galleriesDialog = new GalleriesDialog();
		loginDialog = new LoginDialog();
		nickDialog = new NickDialog(this);
		accountDialog = new AccountDialog();
		changePwDialog = new ChangePwDialog();
		registerDialog = new RegisterDialog();

		initGlobalResizeHandler();

		// activate the nickname button
		$("#manage_account_btn").click(manageAccount);
	}

	function SnapshotUI() {
		var modDialog = new ModDialog("snapshot", opts["snapshotID"]);
		$("#mod_button").click(function() {
			modDialog.show();
		});
	}

	// either ask user for nickname, or give them the option of logging out
	function manageAccount() {
		if (this.conf["sessionData"]["type"] == "guest") {
			nickDialog.show(); // this starts the login flow by asking for a nickname
		} else {
			accountDialog.show();
		}
	}

	function initGlobalResizeHandler() {
		$(window).resize(function() {
			// jquery dialog window resize positioning fix
		 	// see https://stackoverflow.com/questions/3060146/how-to-auto-center-jquery-ui-dialog-when-resizing-browser
			$(".ui-dialog-content:visible").each(function () {
				$(this).dialog("option", "position", $(this).dialog("option", "position"));
			});
		})
	}

	this.receiveSessionData = function(sessionData) {
		this.conf["sessionData"] = sessionData;
		insertSessionName("nick_indicator", sessionData);
	}

	// Insert a session name with some styling
	function insertSessionName(elementID, sessionData) {
		$("#"+elementID).text(sessionData["name"]); // using .text() 	escapes html

		// gotta be a nicer way of doing this...
		if (sessionData["type"] == "mod") {
			$("#"+elementID).addClass("nick_indicator_mod");
			$("#"+elementID).removeClass("nick_indicator_user");
			$("#"+elementID).removeClass("nick_indicator_guest");
			
		} else if (sessionData["type"] == "user") {
			$("#"+elementID).removeClass("nick_indicator_mod");
			$("#"+elementID).addClass("nick_indicator_user");
			$("#"+elementID).removeClass("nick_indicator_guest");
		} else {
			$("#"+elementID).removeClass("nick_indicator_mod");
			$("#"+elementID).removeClass("nick_indicator_user");
			$("#"+elementID).addClass("nick_indicator_guest");
		}
	}

	// Render captcha using a specific dom element id
	function renderCaptcha(ctx, idIn) {
		if (ctx.grWidgetID !== undefined) {
			grecaptcha.reset(ctx.grWidgetID);
		} else {
			ctx.grWidgetID = grecaptcha.render(idIn, {"sitekey": this.conf["recaptchaSiteKey"]});	
		}
	}

	function processError(response, okCallback) {
		if (response["error"]) {
			errorDialog.show(response["error"], okCallback);
			return true;
		}	
		if (response["errors"]) {
			var errors = response["errors"];
			var buf = ""
			for (var i = 0; i < errors.length; i++) {
				buf += "<p class=\"modal_message\">"+errors[i]+"</p>"
			}
			errorDialog.show(buf, okCallback);
			return true;
		}
		return false;
	}

	function modalOpenSetup() {
		$(".ui-widget-overlay").css({
			"background-color": "#000",
			"opacity": 0.5,
			"z-index": 1000000020
		});
		$(".ui-dialog").css({
			"z-index": 1000000021
		})
		$(".ui-dialog-titlebar-close").hide();
	}

	this.init();
}

// GENERAL SHARED METHODS ///////////////////////////////////////////////

// just for debugging, see http://stackoverflow.com/questions/951021/what-is-the-javascript-version-of-sleep
// function sleep(ms) {
// 	return new Promise(resolve => setTimeout(resolve, ms));
// }

function setCookie(cname, cvalue, exdays) {
	var d = new Date();
	d.setTime(d.getTime() + (exdays*24*60*60*1000));
	var expires = "expires="+ d.toUTCString();
	document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
}

function getCookie(cname) {
	var name = cname + "=";
	var decodedCookie = decodeURIComponent(document.cookie);
	var ca = decodedCookie.split(';');
	for(var i = 0; i <ca.length; i++) {
		var c = ca[i];
		while (c.charAt(0) == ' ') {
			c = c.substring(1);
		}
		if (c.indexOf(name) == 0) {
			return c.substring(name.length, c.length);
		}
	}
	return null;
}

// For performance measurements
function Timeline() {
	this.entries = [];
	this.log = function(name) {
		var ts = Date.now(); // this is in milliseconds
		this.entries.push({
			name: name,
			ts: ts
		});
	};
	this.dump = function() {
		console.log("Timeline.dump() invoked")
		var currEntry;
		var prevEntry = null;
		for (var i = 0; i < this.entries.length; i++) {
			var currEntry = this.entries[i];
			if (prevEntry != null) {
				var diffMs = currEntry.ts - prevEntry.ts;
				console.log("["+prevEntry.name+"] => ["+currEntry.name+"] "+diffMs+" ms");
			}
			prevEntry = currEntry;
		}
	}
}

