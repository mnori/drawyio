// TODO: Refactor into separate method!
// Wrapper for tool menu UI elements, which use jquery selectmenu
// TODO Pass in an options object instead of all these seperate parameters
function ToolOptionMenu(drawUi, idIn, onOpenIn, getButtonHtmlIn, onSelectIn, isMenuIn) {
	var id = idIn;
	var menuButton = $("#"+id);
	var onOpen = onOpenIn
	var onSelect = onSelectIn;
	var getButtonHtml = getButtonHtmlIn

	// Whether to hide highlighted stuff when the menu opens
	var isMenu = (isMenuIn) ? true : false;

	var self = this; // scoping help
	
	this.init = function(ui) {
		this.ui = ui; // the RoomUI object
		menuButton.selectmenu({

			// When the menu opens, reposition to the desired location to the left of the tool
			open: function() { 
				self.position(); // calls onOpen
			},
			close: function(ev) {
				var button = $("#"+id+"-button");
				button.removeClass("button_pressed");
				button.blur();
			},

			create: function() { setLabel(this); },
			select: function() {
				setLabel(this);
				if (onSelectIn) {
					onSelect($(this).val());
				}
			}
		});
		$("#"+id+"-button").addClass("button_tool");
	}

	function setLabel(element) {
		var brushSize = $("#"+id);
		var widget = brushSize.selectmenu("widget");

		// getButtonHtml obtains the html to display inside the button
		var val = (getButtonHtml != null) ? getButtonHtml($(element).val()) : $(element).val();
		widget.html(
			"<span class=\"ui-selectmenu-text\">"+
				"<i class=\"fa fa-caret-left\" aria-hidden=\"true\"></i>&nbsp;"+val+
			"</span>"
		);
	}

	// Public methods
	this.position = function() {
		var menu = $("#"+id+"-menu").parent();
		if (menu.css("display") == "none") {
			return; // menu not active, nothing to do
		}
		this.ui.closeMenus(id);
		var button = $("#"+id+"-button");

		menu.hide(); // hide to avoid scroll bar problem
		// if we got this far, the menu is active
		if (onOpen != null) {
			onOpen(id);
		}
		var offset = button.offset(); // the offset will now be consistent
		menu.show();

		// get the parent element and reposition it
		menu.css({
			"top": (offset.top - menu.height() + 45)+"px",
			"left": (offset.left - menu.width())+"px",
			"z-index": 1000000012
		});
		if (isMenu) { // hide the selected style
			$("#"+id+"-menu").find(".ui-state-active").removeClass("ui-state-active")
		}
		$("#"+id+"-button").addClass("button_pressed");
	}


	this.close = function() {
		$("#"+id+"-button").removeClass("button_pressed");
		$("#"+id+"").selectmenu("close");
	}

	this.isOpen = function() {
		if ($("#"+id+"-menu").parent().css("display") != "none") {
			return true;
		}
		return false
	}
}
