// Contains JS that runs on all pages.
// (C) 2017 drawy.io

// GLOBAL ///////////////////////////////////////////////////////////////////////////////

function Base(conf) {
	var self = this;
	self.conf = conf;

	var roomDialog, errorDialog, infoDialog, galleriesDialog, loginDialog, nickDialog, 
		accountDialog, changePwDialog;
		
	this.init = function() {
		var snapID = (typeof(opts) !== "undefined") ? opts["snapshotID"] : null;
		roomDialog = new RoomDialog(snapID);
		errorDialog = new ErrorDialog();
		infoDialog = new InfoDialog();
		galleriesDialog = new GalleriesDialog(self);
		loginDialog = new LoginDialog(self);
		accountDialog = new AccountDialog(self);
		changePwDialog = new ChangePwDialog();

		self.nickDialog = new NickDialog(self);
		self.registerDialog = new RegisterDialog(self);

		initGlobalResizeHandler();

		$("#manage_account_btn").click(manageAccount);
	}

	// either ask user for nickname, or give them the option of logging out
	function manageAccount() {
		if (self.conf["sessionData"]["type"] == "guest") {
			self.nickDialog.show(); // this starts the login flow by asking for a nickname
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
		self.conf["sessionData"] = sessionData;
		self.insertSessionName("nick_indicator", sessionData);
	}

	// Insert a session name with some styling
	this.insertSessionName = function(elementId, sessionData) {
		$("#"+elementId).text(sessionData["name"]); // using .text() 	escapes html

		// gotta be a nicer way of doing this...
		if (sessionData["type"] == "mod") {
			$("#"+elementId).addClass("nick_indicator_mod");
			$("#"+elementId).removeClass("nick_indicator_user");
			$("#"+elementId).removeClass("nick_indicator_guest");
			
		} else if (sessionData["type"] == "user") {
			$("#"+elementId).removeClass("nick_indicator_mod");
			$("#"+elementId).addClass("nick_indicator_user");
			$("#"+elementId).removeClass("nick_indicator_guest");
		} else {
			$("#"+elementId).removeClass("nick_indicator_mod");
			$("#"+elementId).removeClass("nick_indicator_user");
			$("#"+elementId).addClass("nick_indicator_guest");
		}
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

// Render captcha using a specific dom element id
function renderCaptcha(ctx, idIn) {
	if (ctx.grWidgetID !== undefined) {
		grecaptcha.reset(ctx.grWidgetID);
	} else {
		ctx.grWidgetID = grecaptcha.render(idIn, {"sitekey": base.conf["recaptchaSiteKey"]});	
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

// copied from backend version
function AssocArray() {
	this.values = {};
	this.get = function(key) {
		if (typeof(this.values[key]) !== "undefined") {
			return this.values[key];
		}
		return null;
	}
	this.set = function(key, value) {
		this.values[key] = value;
	}
	this.getLength = function() {
		return this.getKeys().length;
	}
	this.getKeys = function() {
		return Object.keys(this.values);
	}
	this.getValues = function() {
		return Object.values(this.values);
	}		

	this.getJson = function() {
		return JSON.stringify(this.values);	
	}
	this.empty = function() {
		this.values = {}
	}
	this.remove = function(key) {
		delete this.values[key]
	}
}
