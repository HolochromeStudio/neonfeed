extends Screen
## Campaign world map: 9 chapters (biomes) x 6 levels. Paper-collage map reconstructed from sheet props.

const NODE_POS := [Vector2(0.24, 0.86), Vector2(0.70, 0.72), Vector2(0.28, 0.56), Vector2(0.72, 0.41), Vector2(0.30, 0.26), Vector2(0.62, 0.09)]
var chapter: int = 1
var map_root: Control
var header: Control
var _t: float = 0.0
var _pulse_nodes: Array = []

func init(a: Dictionary) -> void:
	args = a
	if a.has("focus"):
		chapter = int(String(a["focus"]).split("-")[0])
	else:
		chapter = int(Save.next_level().split("-")[0])

func _ready() -> void:
	music = "menu"
	super._ready()
	UI.paper_bg(self)
	add_topbar(true, "CAMPAIGN")
	_build()

func _build() -> void:
	_pulse_nodes.clear()
	if map_root:
		map_root.queue_free()
	if header:
		header.queue_free()
	var vp := vsize()
	var ch: Dictionary = Data.chapters[chapter - 1]
	var unlocked := Save.chapter_unlocked(chapter)
	# header: biome picture + arrows
	header = Control.new()
	header.position = Vector2(0, Game.safe_top + 112)
	header.size = Vector2(vp.x, 230)
	add_child(header)
	var pic := Atlas.nine("ui_panel_paper", 40)
	pic.size = Vector2(vp.x - 200, 220)
	pic.position = Vector2(100, 0)
	header.add_child(pic)
	var bp := Atlas.rect("biome_" + ch["biome"], 300, 190)
	bp.position = Vector2(24, 16)
	pic.add_child(bp)
	pic.mouse_filter = Control.MOUSE_FILTER_STOP
	pic.gui_input.connect(func(ev):
		if ev is InputEventMouseButton and ev.pressed and ev.button_index == MOUSE_BUTTON_LEFT:
			_world_overview())
	var wh := UI.label("tap for world map", 22, UI.INK_SOFT, false, HORIZONTAL_ALIGNMENT_RIGHT)
	wh.position = Vector2(pic.size.x - 290, 186); wh.size = Vector2(270, 28)
	pic.add_child(wh)
	var nm := UI.label("CHAPTER %d" % chapter, 30, UI.RED, true, HORIZONTAL_ALIGNMENT_LEFT)
	nm.position = Vector2(340, 14); nm.size = Vector2(500, 40)
	pic.add_child(nm)
	var tt := UI.label(ch["name"].to_upper(), 56, UI.INK, true, HORIZONTAL_ALIGNMENT_LEFT)
	tt.position = Vector2(340, 48); tt.size = Vector2(500, 70)
	pic.add_child(tt)
	var sub := UI.label(ch["sub"], 32, UI.INK_SOFT, false, HORIZONTAL_ALIGNMENT_LEFT)
	sub.position = Vector2(340, 118); sub.size = Vector2(500, 40)
	pic.add_child(sub)
	var cleared := 0
	var stars := 0
	for l in ch["levels"]:
		if Save.level_cleared(l["id"]):
			cleared += 1; stars += int(Save.level_info(l["id"]).get("stars", 0))
	var pr := UI.label("%d/6 cleared   %d/18 stars" % [cleared, stars], 30, UI.INK, true, HORIZONTAL_ALIGNMENT_LEFT)
	pr.position = Vector2(340, 160); pr.size = Vector2(500, 40)
	pic.add_child(pr)
	var lb := UI.btn("<", "orange", Vector2(80, 120), func(): _switch(-1), 56)
	lb.position = Vector2(10, 50)
	header.add_child(lb)
	var rb := UI.btn(">", "orange", Vector2(80, 120), func(): _switch(1), 56)
	rb.position = Vector2(vp.x - 90, 50)
	header.add_child(rb)
	UI.slide_in(pic, Vector2(0, -40), 0.0, 0.3)
	# map panel
	var mp := Game.safe_top + 360
	var mh := vp.y - mp - 120 - Game.safe_bottom
	map_root = Control.new()
	map_root.position = Vector2(30, mp)
	map_root.size = Vector2(vp.x - 60, mh)
	map_root.clip_contents = true
	add_child(map_root)
	_build_map(ch, unlocked)
	UI.unfold(map_root, 0.05)
	var frame := Atlas.nine("ui_panel_cardboard", 44)
	frame.size = map_root.size + Vector2(24, 24)
	frame.position = Vector2(-12, -12)
	frame.mouse_filter = Control.MOUSE_FILTER_IGNORE
	# frame drawn behind via z
	frame.z_index = -1
	map_root.add_child(frame)
	frame.show_behind_parent = true
	# bottom quick-play
	var nl := Save.next_level()
	var q := UI.btn("CONTINUE  %s" % nl, "green", Vector2(560, 100), func(): _open_level(int(nl.split("-")[0]), int(nl.split("-")[1])), 44)
	q.position = Vector2((vp.x - 560) * 0.5, vp.y - 110 - Game.safe_bottom)
	add_child(q)

func _world_overview() -> void:
	Audio.sfx("whoosh", 1.1, -6)
	var grid := GridContainer.new()
	grid.columns = 3
	grid.add_theme_constant_override("h_separation", 14)
	grid.add_theme_constant_override("v_separation", 14)
	var p: PaperPopup = null
	for i in 9:
		var C: Dictionary = Data.chapters[i]
		var cell := Control.new()
		cell.custom_minimum_size = Vector2(250, 250)
		var bg := Atlas.nine("ui_panel_paper", 26)
		bg.size = Vector2(250, 250)
		cell.add_child(bg)
		var pic := Atlas.rect("biome_" + C["biome"], 226, 150)
		pic.position = Vector2(12, 10)
		cell.add_child(pic)
		var done := 0
		for l in C["levels"]:
			if Save.level_cleared(l["id"]): done += 1
		var nm := UI.label("%d. %s" % [i + 1, C["name"]], 26, UI.INK, true)
		nm.position = Vector2(0, 162); nm.size = Vector2(250, 36)
		cell.add_child(nm)
		var pr := UI.label("%d/6" % done, 28, UI.GREEN if done == 6 else UI.INK_SOFT, true)
		pr.position = Vector2(0, 198); pr.size = Vector2(250, 36)
		cell.add_child(pr)
		if not Save.chapter_unlocked(i + 1):
			var sh := ColorRect.new(); sh.color = Color(0, 0, 0, 0.5); sh.size = Vector2(250, 250); cell.add_child(sh)
			var lk := UI.icon("icon_lock", 80); lk.position = Vector2(85, 60); cell.add_child(lk)
		var idx := i + 1
		cell.mouse_filter = Control.MOUSE_FILTER_STOP
		cell.gui_input.connect(func(ev):
			if ev is InputEventMouseButton and ev.pressed and ev.button_index == MOUSE_BUTTON_LEFT:
				chapter = idx; Audio.sfx("click"); _build(); if p: p.close())
		grid.add_child(cell)
	p = Game.popup("WORLD MAP", grid, [{"text": "CLOSE", "color": "gray"}], Vector2(900, 1010))

func _switch(d: int) -> void:
	chapter = wrapi(chapter - 1 + d, 0, 9) + 1
	Audio.sfx("whoosh", 1.2, -6)
	_build()

func _build_map(ch: Dictionary, unlocked: bool) -> void:
	var sz := map_root.size
	var look: Dictionary = RoadScene.BIOME_LOOK[ch["biome"]]
	var ground := TextureRect.new()
	ground.texture = Atlas.tile(look["ground"] if ch["biome"] not in ["city_center", "highway", "industrial"] else "ground_grass")
	ground.stretch_mode = TextureRect.STRETCH_TILE
	ground.size = sz
	ground.modulate = look["tint"]
	ground.mouse_filter = Control.MOUSE_FILTER_IGNORE
	map_root.add_child(ground)
	var rs := RandomNumberGenerator.new()
	rs.seed = chapter * 91
	# winding cream road behind the nodes
	var pts := PackedVector2Array()
	var raw: Array = []
	for p in NODE_POS:
		raw.append(Vector2(p.x * sz.x, p.y * sz.y))
	for i in raw.size() - 1:
		var a: Vector2 = raw[i]; var b: Vector2 = raw[i + 1]
		var mid := (a + b) * 0.5 + Vector2((-1.0 if i % 2 == 0 else 1.0) * 70, 0)
		for k in 12:
			var t := float(k) / 12.0
			pts.append(a.lerp(mid, t).lerp(mid.lerp(b, t), t))
	pts.append(raw[raw.size() - 1])
	var edge := Line2D.new()
	edge.points = pts; edge.width = 58; edge.default_color = Color("8b7a58"); edge.joint_mode = Line2D.LINE_JOINT_ROUND
	edge.begin_cap_mode = Line2D.LINE_CAP_ROUND; edge.end_cap_mode = Line2D.LINE_CAP_ROUND
	map_root.add_child(edge)
	var road := Line2D.new()
	road.points = pts; road.width = 46; road.default_color = Color("e6d6b0"); road.joint_mode = Line2D.LINE_JOINT_ROUND
	road.begin_cap_mode = Line2D.LINE_CAP_ROUND; road.end_cap_mode = Line2D.LINE_CAP_ROUND
	map_root.add_child(road)
	# props scattered away from the road
	var keys := ["prop_pine", "prop_tree", "prop_house_a", "prop_house_b", "prop_house_c", "prop_house_d", "prop_bush", "prop_pine"]
	if ch["biome"] == "desert": keys = ["prop_rock", "prop_bush_rocks", "prop_house_c", "prop_rock"]
	if ch["biome"] == "industrial": keys = ["prop_house_d", "prop_junction_box", "prop_barricade_a", "prop_house_c"]
	for i in 26:
		var p := Vector2(rs.randf_range(0.06, 0.94) * sz.x, rs.randf_range(0.04, 0.97) * sz.y)
		var close := false
		for q in pts:
			if p.distance_to(q) < 78.0:
				close = true; break
		if close:
			continue
		var s := Atlas.sprite(keys[rs.randi() % keys.size()], true)
		s.position = p
		s.scale = Vector2.ONE * rs.randf_range(0.8, 1.1)
		if ch["biome"] == "night_city":
			s.modulate = Color(0.55, 0.55, 0.8)
		map_root.add_child(s)
	# dashed red route overlay (completed segments solid)
	for i in raw.size() - 1:
		var a2: Vector2 = raw[i]; var b2: Vector2 = raw[i + 1]
		var done := Save.level_cleared(ch["levels"][i]["id"])
		var steps := int(a2.distance_to(b2) / 38.0)
		for k in steps:
			if k % 2 == 1 and not done:
				continue
			var d := Line2D.new()
			var f0 := float(k) / steps; var f1 := minf(1.0, (float(k) + 0.6) / steps)
			d.points = PackedVector2Array([a2.lerp(b2, f0), a2.lerp(b2, f1)])
			d.width = 9; d.default_color = Color("c9524a") if done else Color("e08a62")
			map_root.add_child(d)
	# nodes
	for i in 6:
		var L: Dictionary = ch["levels"][i]
		var lv := i + 1
		var can := unlocked and Save.level_unlocked(chapter, lv)
		var done := Save.level_cleared(L["id"])
		var boss: bool = lv == 6
		var key := "map_node_lock"
		if can:
			key = "map_node_boss" if boss else ("map_node_star" if done else "map_node_start")
		var node := Control.new()
		node.size = Vector2(120, 120)
		node.position = raw[i] - Vector2(60, 60)
		map_root.add_child(node)
		var spr := Atlas.rect(key, 120, 120)
		node.add_child(spr)
		if not can and boss:
			spr.modulate = Color(1, 0.8, 0.8)
		var num := UI.label(str(lv) if not boss else "BOSS", 34 if not boss else 24, UI.WHITE, true, HORIZONTAL_ALIGNMENT_CENTER, 8)
		num.position = Vector2(0, 86); num.size = Vector2(120, 40)
		node.add_child(num)
		if done:
			var st := UI.stars(int(Save.level_info(L["id"]).get("stars", 1)), 30, 3)
			st.position = Vector2(60 - 45, -22)
			node.add_child(st)
		node.pivot_offset = Vector2(60, 60)
		node.mouse_filter = Control.MOUSE_FILTER_STOP
		var chn := chapter
		node.gui_input.connect(func(ev):
			if ev is InputEventMouseButton and ev.pressed and ev.button_index == MOUSE_BUTTON_LEFT:
				if can:
					Audio.sfx("click"); _open_level(chn, lv)
				else:
					Audio.sfx("error"); Game.toast("Locked - clear the previous level first", "icon_lock"))
		if can and not done:
			_pulse_nodes.append(node)
		UI.pop_in(node, 0.1 + 0.07 * i)
	if not unlocked:
		var lock := UI.label("LOCKED\nClear Chapter %d's boss first" % (chapter - 1), 46, UI.WHITE, true, HORIZONTAL_ALIGNMENT_CENTER, 10)
		lock.position = Vector2(0, sz.y * 0.4); lock.size = Vector2(sz.x, 160)
		map_root.add_child(lock)
		var shade := ColorRect.new()
		shade.color = Color(0, 0, 0, 0.45); shade.size = sz
		shade.mouse_filter = Control.MOUSE_FILTER_IGNORE
		map_root.add_child(shade)
		map_root.move_child(shade, map_root.get_child_count() - 2)

func _process(dt: float) -> void:
	_t += dt
	for n in _pulse_nodes:
		if is_instance_valid(n):
			n.scale = Vector2.ONE * (1.0 + 0.09 * sin(_t * 5.0))

func _open_level(ch: int, lv: int) -> void:
	var C: Dictionary = Data.chapters[ch - 1]
	var L: Dictionary = C["levels"][lv - 1]
	if not Save.level_unlocked(ch, lv):
		Game.toast("Locked", "icon_lock"); return
	# chapter intro dialogue the first time
	if lv == 1 and not Save.data["flags"]["tips"].has("ch%d_pre" % ch):
		Save.data["flags"]["tips"]["ch%d_pre" % ch] = true
		Game.go("cutscene", {"chapter": ch, "scene": "ch%d_pre" % ch, "next": "map", "next_args": {"focus": "%d-%d" % [ch, lv]}}, true, false)
		return
	var body := VBoxContainer.new()
	body.add_theme_constant_override("separation", 10)
	body.custom_minimum_size = Vector2(760, 0)
	var info := "[b]Waves[/b] %d%s    [b]Difficulty[/b] %s\n[b]Rewards[/b] %d coins, %d XP, %d cards per deck vehicle" % [L["waves"], "  +  BOSS" if lv == 6 else "", "I".repeat(1 + int((L["difficulty"] - 1.0) / 0.1)), L["coins"], L["xp"], L["cards"]]
	var r := UI.rich(info, 32, UI.INK)
	r.custom_minimum_size = Vector2(760, 0)
	body.add_child(r)
	if lv == 6:
		var bd: Dictionary = Data.bosses[C["boss"]]
		var br := UI.rich("[b]BOSS:[/b] %s, the %s - %s" % [bd["name"], bd["title"], bd["blurb"]], 30, UI.RED)
		br.custom_minimum_size = Vector2(760, 0)
		body.add_child(br)
	if L["unlock"] != "" and not Save.owns(L["unlock"]):
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 18)
		var holder := Control.new()
		holder.custom_minimum_size = Vector2(150, 200)
		holder.add_child(UI.unit_card(L["unlock"], Vector2(150, 200), false))
		row.add_child(holder)
		var ul := UI.label("First clear unlocks\n%s" % Data.units[L["unlock"]]["name"], 34, UI.INK, true, HORIZONTAL_ALIGNMENT_LEFT)
		ul.custom_minimum_size = Vector2(560, 100)
		row.add_child(ul)
		body.add_child(row)
	var cleared := Save.level_info(L["id"])
	if not cleared.is_empty():
		body.add_child(UI.label("Best: %d stars" % int(cleared.get("stars", 0)), 32, UI.INK_SOFT, true))
	Game.popup(L["name"].to_upper(), body, [{"text": "BACK", "color": "gray"}, {"text": "PLAY!", "color": "green", "cb": func():
		var go_run := func(): PreRun.show("story", {"chapter": ch, "level": lv, "title": L["name"]})
		if lv == 6 and not Save.data["flags"]["tips"].has("ch%d_boss" % ch):
			Save.data["flags"]["tips"]["ch%d_boss" % ch] = true
			Game.play_dialogue("ch%d_boss" % ch, go_run)
		else:
			go_run.call()}], Vector2(900, 860))
