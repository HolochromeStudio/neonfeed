extends Screen
## Player profile: doll, rename, level and lifetime statistics.

func _ready() -> void:
	music = "menu"
	super._ready()
	UI.paper_bg(self, "teal")
	add_topbar(true, "PROFILE")
	var vp := vsize()
	var y := Game.safe_top + 120.0
	var card := Atlas.nine("ui_panel_cream", 44)
	card.size = Vector2(vp.x - 60, 520)
	card.position = Vector2(30, y)
	add_child(card)
	var doll := Doll.new()
	doll.scale = Vector2(1.5, 1.5)
	doll.position = Vector2(260, 490)
	card.add_child(doll)
	var name_l := UI.label(String(Save.data["profile"]["name"]), 56, UI.INK, true, HORIZONTAL_ALIGNMENT_LEFT)
	name_l.position = Vector2(480, 40); name_l.size = Vector2(500, 76)
	card.add_child(name_l)
	var lv := UI.label("LEVEL %d" % Save.player_level(), 44, UI.RED, true, HORIZONTAL_ALIGNMENT_LEFT)
	lv.position = Vector2(480, 120); lv.size = Vector2(500, 56)
	card.add_child(lv)
	var bb := Atlas.nine("ui_bar_bg", 18); bb.size = Vector2(460, 30); bb.position = Vector2(480, 190); card.add_child(bb)
	var xf := float(Save.data["profile"]["xp"]) / float(Save.xp_needed(Save.player_level()))
	var bf := Atlas.nine("ui_bar_fill_blue", 18); bf.size = Vector2(maxf(18.0, 460.0 * xf), 30); bf.position = bb.position; card.add_child(bf)
	var xl := UI.label("%d / %d XP" % [Save.data["profile"]["xp"], Save.xp_needed(Save.player_level())], 26, UI.INK_SOFT)
	xl.position = Vector2(480, 224); xl.size = Vector2(460, 34); card.add_child(xl)
	var rn := UI.btn("RENAME", "blue", Vector2(260, 84), func(): _rename(name_l), 34)
	rn.position = Vector2(480, 290); card.add_child(rn)
	var cu := UI.btn("CUSTOMIZE", "mint", Vector2(300, 84), func(): Game.go("customize"), 32)
	cu.position = Vector2(480, 390); card.add_child(cu)
	y += 540
	var st := Atlas.nine("ui_panel_paper", 44)
	st.size = Vector2(vp.x - 60, vp.y - y - 30 - Game.safe_bottom)
	st.position = Vector2(30, y)
	add_child(st)
	var g := GridContainer.new()
	g.columns = 2
	g.position = Vector2(50, 30)
	g.add_theme_constant_override("h_separation", 30)
	g.add_theme_constant_override("v_separation", 4)
	st.add_child(g)
	var rows := [["Enemies defeated", Save.stat("kills")], ["Merges", Save.stat("merges")], ["Vehicles deployed", Save.stat("deploys")], ["Waves survived", Save.stat("waves")],
		["Runs won", Save.stat("wins")], ["Bosses defeated", Save.stat("bosses")], ["Best merge rank", Save.stat("max_rank")], ["Critical hits", Save.stat("crits")],
		["Survival best wave", int(Save.data["survival"]["best_wave"])], ["PvP record", "%d-%d (%d)" % [Save.data["pvp"]["wins"], Save.data["pvp"]["losses"], Save.data["pvp"]["rating"]]],
		["Co-op wins", Save.data["coop"]["wins"]], ["Chapters cleared", Save.chapters_cleared()], ["Vehicles owned", "%d / 60" % Save.owned_count()], ["Achievements", "%d / %d" % [Save.data["achievements"].values().filter(func(a): return a.get("claimed", false)).size(), Data.achievements.size()]],
		["Upgrades taken", Save.stat("upgrades")], ["Runs played", Save.stat("runs")]]
	for r in rows:
		var a := UI.label(r[0], 32, UI.INK_SOFT, false, HORIZONTAL_ALIGNMENT_LEFT)
		a.custom_minimum_size = Vector2(560, 56)
		var b := UI.label(str(r[1]), 38, UI.INK, true, HORIZONTAL_ALIGNMENT_RIGHT)
		b.custom_minimum_size = Vector2(st.size.x - 100 - 560 - 30, 56)
		g.add_child(a); g.add_child(b)

func _rename(lbl: Label) -> void:
	var le := LineEdit.new()
	le.text = String(Save.data["profile"]["name"])
	le.max_length = 12
	le.custom_minimum_size = Vector2(600, 90)
	le.add_theme_font_size_override("font_size", 46)
	Game.popup("RENAME", le, [{"text": "CANCEL", "color": "gray"}, {"text": "SAVE", "color": "green", "cb": func():
		var nm := le.text.strip_edges()
		if nm != "":
			Save.data["profile"]["name"] = nm; Save.mark_dirty(); lbl.text = nm}], Vector2(860, 480))
