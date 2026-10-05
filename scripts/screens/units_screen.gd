extends Screen
## Collection + garage + deck builder. Tap a vehicle for details/upgrades; pick deck slots at the top.

var deck_idx: int = 0
var sel_slot: int = 0
var filter: String = "all"
var deck_row: HBoxContainer
var grid: GridContainer
var syn_label: RichTextLabel
var deck_btns: Array = []
var count_label: Label
var scroll: ScrollContainer

func _ready() -> void:
	music = "menu"
	super._ready()
	UI.paper_bg(self, "blue")
	add_topbar(true, "UNITS")
	deck_idx = int(Save.data["active_deck"])
	var vp := vsize()
	var y := Game.safe_top + 112.0
	# deck selector tabs
	var tabs := HBoxContainer.new()
	tabs.position = Vector2(30, y)
	tabs.add_theme_constant_override("separation", 12)
	add_child(tabs)
	for i in 3:
		var b := UI.btn("DECK %d" % (i + 1), "teal" if i == deck_idx else "gray", Vector2(190, 76), func(): _set_deck(i), 34)
		tabs.add_child(b)
		deck_btns.append(b)
	count_label = UI.label("", 34, UI.WHITE, true, HORIZONTAL_ALIGNMENT_RIGHT, 6)
	count_label.position = Vector2(vp.x - 440, y); count_label.size = Vector2(410, 76)
	add_child(count_label)
	y += 90
	# deck strip
	var dp := Atlas.nine("ui_panel_cardboard", 40)
	dp.size = Vector2(vp.x - 40, 300)
	dp.position = Vector2(20, y)
	add_child(dp)
	deck_row = HBoxContainer.new()
	deck_row.position = Vector2(26, 22)
	deck_row.size = Vector2(dp.size.x - 52, 200)
	deck_row.add_theme_constant_override("separation", 10)
	deck_row.alignment = BoxContainer.ALIGNMENT_CENTER
	dp.add_child(deck_row)
	syn_label = UI.rich("", 26, UI.WHITE)
	syn_label.position = Vector2(30, 232)
	syn_label.size = Vector2(dp.size.x - 60, 60)
	syn_label.fit_content = false
	dp.add_child(syn_label)
	y += 316
	# filters
	var fr := HBoxContainer.new()
	fr.position = Vector2(20, y)
	fr.add_theme_constant_override("separation", 6)
	add_child(fr)
	for f in ["all", "common", "uncommon", "rare", "epic", "legendary", "mythic"]:
		var col: String = "gray" if f == "all" else {"common": "gray", "uncommon": "green", "rare": "blue", "epic": "lavender", "legendary": "orange", "mythic": "red"}[f]
		var b := UI.btn("ALL" if f == "all" else f.substr(0, 3).to_upper(), col, Vector2(138, 64), func(): filter = f; _fill_grid(), 26)
		fr.add_child(b)
	y += 76
	scroll = ScrollContainer.new()
	scroll.position = Vector2(10, y)
	scroll.size = Vector2(vp.x - 20, vp.y - y - Game.safe_bottom - 10)
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	add_child(scroll)
	grid = GridContainer.new()
	grid.columns = 4
	grid.add_theme_constant_override("h_separation", 12)
	grid.add_theme_constant_override("v_separation", 12)
	scroll.add_child(grid)
	_refresh_deck()
	_fill_grid()
	if args.has("tab") and args["tab"] == "deck":
		pass

func _set_deck(i: int) -> void:
	deck_idx = i
	Save.data["active_deck"] = i
	Save.mark_dirty()
	for j in deck_btns.size():
		var b: PaperButton = deck_btns[j]
		b._color = "teal" if j == i else "gray"
		b._set_tex("ui_btn_%s_up" % b._color)
	sel_slot = 0
	_refresh_deck()

func _deck() -> Array:
	return Save.data["decks"][deck_idx]

func _refresh_deck() -> void:
	for c in deck_row.get_children():
		c.queue_free()
	var dk := _deck()
	for i in 5:
		var holder := Control.new()
		holder.custom_minimum_size = Vector2(190, 200)
		deck_row.add_child(holder)
		var slot_bg := Atlas.nine("ui_slot_ok" if i == sel_slot else "ui_slot", 36)
		slot_bg.size = Vector2(190, 200)
		holder.add_child(slot_bg)
		if i < dk.size():
			var c := UI.unit_card(dk[i], Vector2(170, 190), true)
			c.position = Vector2(10, 5)
			holder.add_child(c)
		else:
			var pl := UI.label("+", 90, Color(1, 1, 1, 0.5), true)
			pl.size = Vector2(190, 200)
			holder.add_child(pl)
		holder.mouse_filter = Control.MOUSE_FILTER_STOP
		var idx := i
		holder.gui_input.connect(func(ev):
			if ev is InputEventMouseButton and ev.pressed and ev.button_index == MOUSE_BUTTON_LEFT:
				sel_slot = idx
				Audio.sfx("click")
				if idx < _deck().size():
					_open_detail(_deck()[idx])
				_refresh_deck())
	count_label.text = "%d / 5  %s" % [dk.size(), "READY" if dk.size() == 5 else "INCOMPLETE"]
	count_label.add_theme_color_override("font_color", Color("9be08a") if dk.size() == 5 else Color("ff9a8a"))
	# synergy preview
	var tag_counts := {}
	for id in dk:
		for t in Data.units[id]["tags"]:
			tag_counts[t] = int(tag_counts.get(t, 0)) + 1
	var parts: Array = []
	for s in Data.synergies:
		var count := 0
		if s.has("tag"):
			count = int(tag_counts.get(s["tag"], 0))
		else:
			for t in s["mix"]:
				if tag_counts.has(t): count += 1
		for tier in s["tiers"]:
			if count >= int(tier["n"]):
				parts.append(tier["name"])
	var best_tags: Array = []
	for t in tag_counts:
		if tag_counts[t] >= 2:
			best_tags.append("%s x%d" % [t, tag_counts[t]])
	var txt := "[b]Tags:[/b] " + (", ".join(best_tags) if not best_tags.is_empty() else "mixed")
	if not parts.is_empty():
		txt += "   [b]Synergies:[/b] " + ", ".join(parts)
	syn_label.text = txt
	_fill_grid()

func _fill_grid() -> void:
	for c in grid.get_children():
		c.queue_free()
	var list: Array = Data.unit_list.duplicate()
	for u in list:
		if filter != "all" and u["rarity"] != filter:
			continue
		var id: String = u["id"]
		var owned := Save.owns(id)
		var in_deck := id in _deck()
		var holder := Control.new()
		holder.custom_minimum_size = Vector2(250, 330)
		var card := UI.unit_card(id, Vector2(250, 330), owned, not owned)
		holder.add_child(card)
		if in_deck:
			var tag := UI.label("IN DECK", 26, UI.WHITE, true, HORIZONTAL_ALIGNMENT_CENTER, 6)
			var tb := Atlas.nine("ui_ribbon_teal", 16)
			tb.size = Vector2(150, 40); tb.position = Vector2(50, 50)
			holder.add_child(tb)
			tag.size = tb.size
			tb.add_child(tag)
		if not owned:
			var lk := UI.icon("icon_lock", 70)
			lk.position = Vector2(90, 100)
			holder.add_child(lk)
		elif Save.can_upgrade(id):
			var up := UI.icon("icon_alert", 56)
			up.position = Vector2(190, 8)
			holder.add_child(up)
		elif Save.data["units"][id].get("new", false):
			var nb := UI.label("NEW", 28, UI.WHITE, true, HORIZONTAL_ALIGNMENT_CENTER, 6)
			var nbg := Atlas.nine("ui_panel_red", 16)
			nbg.size = Vector2(80, 40); nbg.position = Vector2(8, 8)
			holder.add_child(nbg)
			nb.size = nbg.size
			nbg.add_child(nb)
		UI.tappable(holder, func(): Audio.sfx("click"); _open_detail(id))
		grid.add_child(holder)
	if grid.get_child_count() > 0:
		grid.get_child(0).modulate.a = 1.0

func _open_detail(id: String) -> void:
	var d: Dictionary = Data.units[id]
	var owned := Save.owns(id)
	if owned and Save.data["units"][id].get("new", false):
		Save.data["units"][id]["new"] = false
	var body := VBoxContainer.new()
	body.add_theme_constant_override("separation", 8)
	body.custom_minimum_size = Vector2(780, 0)
	var top := HBoxContainer.new()
	top.add_theme_constant_override("separation", 16)
	var cardh := Control.new()
	cardh.custom_minimum_size = Vector2(250, 340)
	cardh.add_child(UI.unit_card(id, Vector2(250, 330), owned, not owned))
	top.add_child(cardh)
	var info := VBoxContainer.new()
	info.add_theme_constant_override("separation", 4)
	var lvl := Save.unit_level(id)
	var dps_base := float(d["dmg"]) * (1.0 + 0.07 * (lvl - 1))
	info.add_child(UI.label("%s%s" % [d["name"], ("  Lv %d" % lvl) if owned else "  (locked)"], 38, UI.INK, true, HORIZONTAL_ALIGNMENT_LEFT))
	var st := UI.rich("[b]DMG[/b] %s   [b]SPD[/b] %.2f/s   [b]RANGE[/b] %d\n[b]Target[/b] %s   [b]Attack[/b] %s\n[b]Roles[/b] %s\n[b]Tags[/b] %s" % [UI.fmt_num(dps_base), 1.0 / float(d["interval"]), int(d["range"]), d["target"], d["proj"], ", ".join(d["roles"]), ", ".join(d["tags"])], 27, UI.INK)
	st.custom_minimum_size = Vector2(500, 0)
	info.add_child(st)
	var ab := UI.rich("[b]%s:[/b] %s" % [d["ability"], d["ability_desc"]], 28, UI.RED)
	ab.custom_minimum_size = Vector2(500, 0)
	info.add_child(ab)
	var fl := UI.label("\"%s\"" % d["flavor"], 24, UI.INK_SOFT, false, HORIZONTAL_ALIGNMENT_LEFT)
	fl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	fl.custom_minimum_size = Vector2(500, 0)
	info.add_child(fl)
	top.add_child(info)
	body.add_child(top)
	# rank table
	var rank := UI.label("Merge ranks (damage): " + "  ".join(range(7).map(func(i): return "R%d x%s" % [i + 1, UI.fmt_num(BattleSim.RANK_DMG[i])])), 22, UI.INK_SOFT)
	rank.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	rank.custom_minimum_size = Vector2(760, 0)
	body.add_child(rank)
	var buttons: Array = [{"text": "CLOSE", "color": "gray"}]
	if owned:
		var cost := Save.upgrade_cost(id)
		var up_text := "MAX LEVEL" if cost.is_empty() else "UPGRADE  %d cards + %d coins" % [cost["cards"], cost["coins"]]
		if cost.is_empty():
			body.add_child(UI.label("MAX LEVEL", 34, UI.GREEN, true))
		else:
			body.add_child(UI.label("Cards %d/%d    Coins %d/%d" % [Save.unit_cards(id), cost["cards"], Save.coins(), cost["coins"]], 30, UI.INK, true))
		var in_deck := id in _deck()
		buttons.append({"text": "REMOVE" if in_deck else "EQUIP", "color": "blue", "cb": func(): _equip(id)})
		if not cost.is_empty():
			buttons.append({"text": "UPGRADE", "color": "green" if Save.can_upgrade(id) else "gray", "cb": func():
				if Save.upgrade_unit(id):
					Audio.sfx("levelup"); Game.toast("%s upgraded to Lv %d!" % [d["name"], Save.unit_level(id)], "icon_star"); _refresh_deck()
				else:
					Audio.sfx("error"); Game.toast("Not enough cards or coins", "icon_alert")})
	else:
		body.add_child(UI.label("Unlock via the campaign, shop or achievements.", 28, UI.INK_SOFT))
	Game.popup("VEHICLE", body, buttons, Vector2(900, 1040))

func _equip(id: String) -> void:
	var dk: Array = _deck()
	if id in dk:
		dk.erase(id)
	else:
		if dk.size() < 5:
			dk.append(id)
		else:
			dk[clampi(sel_slot, 0, 4)] = id
	Save.data["decks"][deck_idx] = dk
	Save.mark_dirty()
	Audio.sfx("coin")
	_refresh_deck()
