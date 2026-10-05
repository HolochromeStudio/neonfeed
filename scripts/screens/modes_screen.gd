extends Screen
## Mode select using the four mode cards from the sheet.

func _ready() -> void:
	music = "menu"
	super._ready()
	UI.paper_bg(self, "teal")
	add_topbar(true, "PLAY")
	var vp := vsize()
	var cw := (vp.x - 100) * 0.5
	var ch := cw * 1.18
	var modes := [
		["story", "mode_story", "STORY", func(): Game.go("map"), _story_sub()],
		["survival", "mode_survival", "SURVIVAL", func(): PreRun.show("survival", {"title": "Endless waves - a boss every 10!"}), "Best: wave %d" % int(Save.data["survival"]["best_wave"])],
		["coop", "mode_coop", "CO-OP", func(): _coop_select(), "Wins: %d" % int(Save.data["coop"]["wins"])],
		["pvp", "mode_pvp", "PVP", func(): _pvp_select(), "Rating %d" % int(Save.data["pvp"]["rating"])],
	]
	var y0 := Game.safe_top + 130
	for i in modes.size():
		var m: Array = modes[i]
		var holder := Control.new()
		holder.position = Vector2(40 + (i % 2) * (cw + 20), y0 + (i / 2) * (ch + 150))
		holder.size = Vector2(cw, ch + 120)
		add_child(holder)
		var card := Atlas.rect(m[1], cw, ch)
		card.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		holder.add_child(card)
		var sub := UI.label(m[4], 36, UI.WHITE, true, HORIZONTAL_ALIGNMENT_CENTER, 7)
		sub.position = Vector2(0, ch + 4); sub.size = Vector2(cw, 44)
		holder.add_child(sub)
		var b := UI.btn("PLAY", "teal", Vector2(cw * 0.7, 80), m[3], 40)
		b.position = Vector2(cw * 0.15, ch + 52)
		holder.add_child(b)
		holder.mouse_filter = Control.MOUSE_FILTER_PASS
		UI.pop_in(holder, 0.08 * i)
		card.mouse_filter = Control.MOUSE_FILTER_STOP
		card.gui_input.connect(func(ev):
			if ev is InputEventMouseButton and ev.pressed:
				m[3].call())
	var tip := UI.label("Tip: build your deck BEFORE the run. Each mode uses your active deck.", 30, Color(1, 1, 1, 0.8), false)
	tip.position = Vector2(40, vp.y - 120 - Game.safe_bottom)
	tip.size = Vector2(vp.x - 80, 80)
	tip.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	add_child(tip)

func _story_sub() -> String:
	var nl := Save.next_level()
	return "Next: %s" % nl

func _coop_select() -> void:
	var body := VBoxContainer.new()
	body.add_theme_constant_override("separation", 10)
	var partners := [
		["Officer Dana", "cop", ["police", "fire_engine", "ambulance", "tow_truck", "school_bus"], "First Responders deck"],
		["Gus the Mechanic", "mechanic", ["tow_truck", "crane_truck", "snowplow", "heavy_wrecker", "street_sweeper"], "Heavy Metal deck"],
		["Vince Vortex", "rival", ["race_car", "highway_patrol", "supercar", "taxi", "scooter"], "Speed Demons deck"],
	]
	var p: PaperPopup = null
	for pt in partners:
		var row := Control.new()
		row.custom_minimum_size = Vector2(760, 120)
		var holder := UI.btn("%s  -  %s" % [pt[0], pt[3]], "blue", Vector2(760, 110), func():
			if p: p.close()
			Game.play_dialogue("coop_intro", func(): PreRun.show("coop", {"partner_deck": pt[2], "title": "Co-op with %s" % pt[0]})), 32)
		row.add_child(holder)
		body.add_child(row)
	p = Game.popup("CHOOSE A PARTNER", body, [{"text": "CANCEL", "color": "gray"}], Vector2(860, 720))

func _pvp_select() -> void:
	var body := VBoxContainer.new()
	body.add_theme_constant_override("separation", 10)
	var rivals := [
		["Rookie Rita", 0.45, ["taxi", "compact", "pickup", "city_bus", "delivery_van"], "Easy"],
		["Dex the Courier", 0.65, ["courier_bike", "delivery_van", "mail_van", "scooter", "electric_taxi"], "Medium"],
		["Vince Vortex", 0.9, ["race_car", "police", "highway_patrol", "taxi", "interceptor"], "Hard"],
	]
	var p: PaperPopup = null
	for r in rivals:
		var b := UI.btn("%s  (%s)" % [r[0], r[3]], "red" if r[3] == "Hard" else ("orange" if r[3] == "Medium" else "green"), Vector2(760, 110), func():
			if p: p.close()
			if r[0] == "Vince Vortex":
				Game.play_dialogue("rival_pvp", func(): PreRun.show("pvp", {"title": "Duel vs %s" % r[0], "opponent": {"name": r[0], "skill": r[1], "deck": r[2]}}))
			else:
				PreRun.show("pvp", {"title": "Duel vs %s" % r[0], "opponent": {"name": r[0], "skill": r[1], "deck": r[2]}}), 32)
		body.add_child(b)
	var note := UI.label("Same traffic, same seed - sent enemies hurt your rival! (Offline duel vs a simulated opponent)", 28, UI.INK_SOFT)
	note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	note.custom_minimum_size = Vector2(760, 90)
	body.add_child(note)
	p = Game.popup("PICK A RIVAL", body, [{"text": "CANCEL", "color": "gray"}], Vector2(860, 800))
