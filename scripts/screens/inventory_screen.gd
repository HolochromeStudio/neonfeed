extends Screen
## Boosters, vehicle cards, cosmetics summary.

func _ready() -> void:
	music = "menu"
	super._ready()
	UI.paper_bg(self, "sun")
	add_topbar(true, "INVENTORY")
	var vp := vsize()
	var sc := ScrollContainer.new()
	sc.position = Vector2(20, Game.safe_top + 120)
	sc.size = Vector2(vp.x - 40, vp.y - Game.safe_top - 130 - Game.safe_bottom)
	sc.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	add_child(sc)
	var vb := VBoxContainer.new()
	vb.add_theme_constant_override("separation", 14)
	vb.custom_minimum_size = Vector2(vp.x - 60, 0)
	sc.add_child(vb)
	vb.add_child(UI.label("BOOSTERS", 44, UI.WHITE, true, HORIZONTAL_ALIGNMENT_LEFT, 8))
	var info := {"rush_ticket": ["Rush Ticket", "icon_bolt", "Start a run with +30 SP."], "spare_tire": ["Spare Tire", "icon_tire", "+6 city HP for one run."], "lucky_dice": ["Lucky Dice", "icon_star", "x1.5 coin rewards for one run."]}
	for id in info:
		var r := Control.new()
		r.custom_minimum_size = Vector2(vp.x - 60, 120)
		var bg := Atlas.nine("ui_panel_paper", 34)
		bg.size = r.custom_minimum_size
		r.add_child(bg)
		var ic := UI.icon(info[id][1], 80); ic.position = Vector2(26, 20); r.add_child(ic)
		var t := UI.label("%s   x%d" % [info[id][0], int(Save.data["inventory"].get(id, 0))], 38, UI.INK, true, HORIZONTAL_ALIGNMENT_LEFT)
		t.position = Vector2(130, 12); t.size = Vector2(700, 50); r.add_child(t)
		var d := UI.label(info[id][2], 28, UI.INK_SOFT, false, HORIZONTAL_ALIGNMENT_LEFT)
		d.position = Vector2(130, 62); d.size = Vector2(700, 40); r.add_child(d)
		vb.add_child(r)
	vb.add_child(UI.label("Pick boosters on the Get Ready screen before a run.", 28, Color(1, 1, 1, 0.75)))
	vb.add_child(UI.label("VEHICLE CARDS", 44, UI.WHITE, true, HORIZONTAL_ALIGNMENT_LEFT, 8))
	var g := GridContainer.new()
	g.columns = 5
	g.add_theme_constant_override("h_separation", 8)
	g.add_theme_constant_override("v_separation", 8)
	var any := false
	for id in Save.data["units"]:
		var n := Save.unit_cards(id)
		if n <= 0:
			continue
		any = true
		var h := Control.new()
		h.custom_minimum_size = Vector2(190, 260)
		h.add_child(UI.unit_card(id, Vector2(190, 250), true))
		var c := UI.label("%d cards" % n, 26, UI.WHITE, true, HORIZONTAL_ALIGNMENT_CENTER, 6)
		c.position = Vector2(0, 205); c.size = Vector2(190, 36)
		h.add_child(c)
		g.add_child(h)
	if any:
		vb.add_child(g)
	else:
		vb.add_child(UI.label("No spare cards yet - win runs to earn them!", 30, Color(1, 1, 1, 0.8)))
	vb.add_child(UI.label("COLLECTION", 44, UI.WHITE, true, HORIZONTAL_ALIGNMENT_LEFT, 8))
	var owned_c := 0
	for c in Data.cosmetics:
		if Save.has_cosmetic(c["id"]): owned_c += 1
	vb.add_child(UI.label("Vehicles: %d / 60     Cosmetics: %d / %d     Relics discovered: %d / %d" % [Save.owned_count(), owned_c, Data.cosmetics.size(), Save.data["relics_seen"].size(), Data.relics.size()], 32, UI.WHITE, true, HORIZONTAL_ALIGNMENT_LEFT, 6))
