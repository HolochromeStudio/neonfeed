class_name PreRun
extends RefCounted
## "Before the run" popup: shows the active deck (build it BEFORE entering a run), boosters, and starts the mode.

static func show(mode: String, params: Dictionary = {}) -> void:
	var deck: Array = Save.active_deck()
	var body := VBoxContainer.new()
	body.add_theme_constant_override("separation", 14)
	body.custom_minimum_size = Vector2(760, 0)
	var title := params.get("title", "")
	if title != "":
		var t := UI.label(String(title), 40, UI.INK, true)
		body.add_child(t)
	var deck_lbl := UI.label("DECK %d" % (int(Save.data["active_deck"]) + 1), 34, UI.RED, true)
	body.add_child(deck_lbl)
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 8)
	for id in deck:
		var c := UI.unit_card(id, Vector2(136, 190), true)
		var h := Control.new()
		h.custom_minimum_size = Vector2(136, 190)
		h.add_child(c)
		row.add_child(h)
	body.add_child(row)
	var boosters: Array = []
	var brow := HBoxContainer.new()
	brow.alignment = BoxContainer.ALIGNMENT_CENTER
	brow.add_theme_constant_override("separation", 16)
	var binfo := {"rush_ticket": ["RUSH +30 SP", "icon_bolt"], "spare_tire": ["SPARE +6 HP", "icon_tire"], "lucky_dice": ["LUCKY x1.5 COINS", "icon_star"]}
	for b in binfo:
		var cnt: int = int(Save.data["inventory"].get(b, 0))
		if cnt <= 0 or mode == "pvp" or mode == "tutorial":
			continue
		var tb := Button.new()
		tb.toggle_mode = true
		tb.custom_minimum_size = Vector2(220, 100)
		tb.text = "%s (%d)" % [binfo[b][0], cnt]
		tb.add_theme_font_override("font", UI.font_body if UI.font_body else null)
		tb.add_theme_font_size_override("font_size", 26)
		tb.toggled.connect(func(on):
			if on: boosters.append(b)
			else: boosters.erase(b))
		brow.add_child(tb)
	if brow.get_child_count() > 0:
		body.add_child(UI.label("BOOSTERS", 30, UI.INK_SOFT, true))
		body.add_child(brow)
	var valid := Save.deck_valid(deck)
	if not valid:
		body.add_child(UI.label("Your deck needs 5 vehicles!", 34, Color("c0302a"), true))
	var buttons := [
		{"text": "EDIT DECK", "color": "blue", "cb": func(): Game.go("units", {"tab": "deck"})},
		{"text": "START!", "color": "green", "cb": func():
			if not valid:
				Game.toast("Deck needs 5 vehicles", "icon_alert")
				return
			var p := params.duplicate()
			p["boosters"] = boosters
			Game.start_run(Game.build_cfg(mode, p)), "keep": false},
	]
	Game.popup("GET READY", body, buttons, Vector2(900, 900 if brow.get_child_count() > 0 else 760))
