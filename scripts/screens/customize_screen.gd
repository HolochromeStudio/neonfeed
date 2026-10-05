extends Screen
## Character customization (also used as the final step of player creation with args.create = true).

const CATS := [["skin", "SKIN"], ["hair", "HAIR"], ["hat", "HAT"], ["glasses", "GLASSES"], ["accessory", "EXTRAS"], ["top", "TOP"], ["bottom", "BOTTOM"], ["shoes", "SHOES"]]
const PRESETS := [
	["Rookie", "cap_red_blue", {"skin": "skin_2", "hair": "hair_none", "hat": "hat_cap_red_blue", "top": "top_0", "bottom": "bot_0", "shoes": "shoe_0", "glasses": "glasses_none", "accessory": "acc_none"}],
	["Scout", "cap_headphones", {"skin": "skin_1", "hair": "hair_none", "hat": "hat_cap_blue_red", "top": "top_1", "bottom": "bot_1", "shoes": "shoe_0", "glasses": "glasses_none", "accessory": "acc_backpack"}],
	["Mop Top", "brown_hair", {"skin": "skin_1", "hair": "hair_messy_brown", "hat": "hat_none", "top": "top_0", "bottom": "bot_1", "shoes": "shoe_0", "glasses": "glasses_none", "accessory": "acc_none"}],
	["Navy", "cap_blue", {"skin": "skin_3", "hair": "hair_none", "hat": "hat_cap_blue_red", "top": "top_1", "bottom": "bot_0", "shoes": "shoe_0", "glasses": "glasses_none", "accessory": "acc_none"}],
	["Spike", "long_hair", {"skin": "skin_4", "hair": "hair_spiky_black", "hat": "hat_none", "top": "top_0", "bottom": "bot_0", "shoes": "shoe_0", "glasses": "glasses_none", "accessory": "acc_backpack"}],
	["Sunny", "red_curls", {"skin": "skin_0", "hair": "hair_spiky_black", "hat": "hat_cap_red_blue", "top": "top_1", "bottom": "bot_1", "shoes": "shoe_0", "glasses": "glasses_none", "accessory": "acc_none"}],
]
var create_mode: bool = false
var cat: String = "hair"
var doll: Doll
var grid: GridContainer
var name_edit: LineEdit
var _pose_i: int = 0
var tab_btns: Dictionary = {}
var _stage_t: float = 0.0

func init(a: Dictionary) -> void:
	args = a
	create_mode = bool(a.get("create", false))

func _ready() -> void:
	music = "menu"
	super._ready()
	UI.paper_bg(self)
	var vp := vsize()
	if not create_mode:
		add_topbar(true, "CUSTOMIZE")
	var y := Game.safe_top + (20.0 if create_mode else 112.0)
	if create_mode:
		var t := UI.label("WHO ARE YOU?", 72, UI.WHITE, true, HORIZONTAL_ALIGNMENT_CENTER, 12)
		t.position = Vector2(0, y); t.size = Vector2(vp.x, 90)
		add_child(t)
		y += 100
		name_edit = LineEdit.new()
		name_edit.text = String(Save.data["profile"]["name"])
		name_edit.max_length = 12
		name_edit.placeholder_text = "Your name"
		name_edit.alignment = HORIZONTAL_ALIGNMENT_CENTER
		name_edit.add_theme_font_override("font", UI.font_title)
		name_edit.add_theme_font_size_override("font_size", 52)
		name_edit.add_theme_color_override("font_color", UI.INK)
		var sb := StyleBoxFlat.new()
		sb.bg_color = Color("eee0c2"); sb.set_corner_radius_all(14); sb.border_color = UI.INK; sb.set_border_width_all(4)
		name_edit.add_theme_stylebox_override("normal", sb)
		name_edit.add_theme_stylebox_override("focus", sb)
		name_edit.position = Vector2(vp.x * 0.5 - 300, y); name_edit.size = Vector2(600, 90)
		add_child(name_edit)
		y += 110
	# stage: paper spotlight + road strip
	var stage := Atlas.nine("ui_panel_cream", 44)
	stage.size = Vector2(vp.x - 80, 560)
	stage.position = Vector2(40, y)
	add_child(stage)
	var floor_strip := ColorRect.new()
	floor_strip.color = Color("6b6660")
	floor_strip.position = Vector2(56, 425); floor_strip.size = Vector2(stage.size.x - 112, 100)
	stage.add_child(floor_strip)
	var dash := TextureRect.new()
	dash.texture = Atlas.tile("tile_road_dashed_yellow_h")
	dash.stretch_mode = TextureRect.STRETCH_TILE
	dash.position = Vector2(56, 455); dash.size = Vector2(stage.size.x - 112, 40)
	dash.modulate = Color(1, 1, 1, 0.8)
	stage.add_child(dash)
	doll = Doll.new()
	doll.scale = Vector2(1.7, 1.7)
	doll.position = Vector2(stage.size.x * 0.5, 470)
	stage.add_child(doll)
	# pose / random buttons
	var pose := UI.btn("POSE", "blue", Vector2(170, 76), func(): _next_pose(), 32)
	pose.position = Vector2(stage.size.x - 200, 20)
	stage.add_child(pose)
	var rnd := UI.btn("RANDOM", "lavender", Vector2(210, 76), func(): _randomize(), 32)
	rnd.position = Vector2(20, 20)
	stage.add_child(rnd)
	y += 580
	if create_mode:
		var pl := UI.label("Pick a starting look:", 36, UI.WHITE, true, HORIZONTAL_ALIGNMENT_CENTER, 7)
		pl.position = Vector2(0, y); pl.size = Vector2(vp.x, 44)
		add_child(pl)
		y += 50
		var pr := HBoxContainer.new()
		pr.position = Vector2(10, y); pr.size = Vector2(vp.x - 20, 150)
		pr.alignment = BoxContainer.ALIGNMENT_CENTER
		pr.add_theme_constant_override("separation", 6)
		add_child(pr)
		for p in PRESETS:
			var h := Control.new()
			h.custom_minimum_size = Vector2(160, 150)
			var bg := Atlas.nine("ui_panel_paper", 28)
			bg.size = Vector2(160, 150)
			h.add_child(bg)
			var pic := Atlas.rect("pc_" + p[1], 110, 130)
			pic.position = Vector2(25, 10)
			h.add_child(pic)
			h.mouse_filter = Control.MOUSE_FILTER_STOP
			var pp: Dictionary = p[2]
			h.gui_input.connect(func(ev):
				if ev is InputEventMouseButton and ev.pressed:
					for k in pp:
						Save.data["profile"]["look"][k] = pp[k]
					Save.mark_dirty(); doll.look = Save.look(); doll.build(); doll.set_state("happy"); Audio.sfx("pop"); _fill_grid())
			pr.add_child(h)
		y += 160
	# category tabs
	var tabs := HBoxContainer.new()
	tabs.position = Vector2(8, y)
	tabs.add_theme_constant_override("separation", 5)
	add_child(tabs)
	for c in CATS:
		var b := UI.btn(c[1], "teal" if c[0] == cat else "gray", Vector2(126, 66), func(): cat = c[0]; _refresh_tabs(); _fill_grid(), 22)
		tabs.add_child(b)
		tab_btns[c[0]] = b
	y += 76
	var scroll := ScrollContainer.new()
	scroll.position = Vector2(10, y)
	scroll.size = Vector2(vp.x - 20, vp.y - y - Game.safe_bottom - (130 if create_mode else 10))
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	add_child(scroll)
	grid = GridContainer.new()
	grid.columns = 5
	grid.add_theme_constant_override("h_separation", 10)
	grid.add_theme_constant_override("v_separation", 10)
	scroll.add_child(grid)
	_fill_grid()
	if create_mode:
		var done := UI.btn("DONE!", "green", Vector2(620, 110), func(): _finish_create(), 60)
		done.position = Vector2((vp.x - 620) * 0.5, vp.y - 130 - Game.safe_bottom)
		add_child(done)

func _refresh_tabs() -> void:
	for k in tab_btns:
		var b: PaperButton = tab_btns[k]
		b._color = "teal" if k == cat else "gray"
		b._set_tex("ui_btn_%s_up" % b._color)

func _next_pose() -> void:
	var poses := [["idle", "neutral"], ["happy", "happy"], ["walk", "neutral"], ["celebrate", "happy"], ["think", "think"], ["point", "point"], ["angry", "angry"], ["surprised", "surprised"], ["worried", "worried"]]
	_pose_i = (_pose_i + 1) % poses.size()
	doll.set_state(poses[_pose_i][0]); doll.set_mood(poses[_pose_i][1])
	Audio.sfx("pop", 1.2)

func _randomize() -> void:
	for c in CATS:
		var opts: Array = Data.cosmetics.filter(func(x): return x["cat"] == c[0] and Save.has_cosmetic(x["id"]))
		if not opts.is_empty():
			Save.data["profile"]["look"][c[0]] = opts[randi() % opts.size()]["id"]
	Save.mark_dirty()
	doll.look = Save.look(); doll.build(); doll.set_state("happy"); Audio.sfx("merge")
	_fill_grid()

func _fill_grid() -> void:
	for c in grid.get_children():
		c.queue_free()
	var cur: String = Save.look().get(cat, "")
	var items: Array = Data.cosmetics.filter(func(x): return x["cat"] == cat)
	for it in items:
		var id: String = it["id"]
		var owned := Save.has_cosmetic(id) or Save.cosmetic_available(it)
		var cell := Control.new()
		cell.custom_minimum_size = Vector2(200, 200)
		var bg := Atlas.nine("ui_panel_teal" if id == cur else "ui_panel_paper", 30)
		bg.size = Vector2(200, 200)
		cell.add_child(bg)
		if it["key"] != "":
			var ic := Atlas.rect(it["key"], 130, 100)
			ic.position = Vector2(35, 18)
			cell.add_child(ic)
		elif it["color"] != Color.WHITE:
			var sw := ColorRect.new()
			sw.color = it["color"]
			sw.position = Vector2(34, 24); sw.size = Vector2(60, 76)
			cell.add_child(sw)
			var ico: String = it.get("icon", "")
			if ico != "" and Atlas.has(ico):
				var ic2 := Atlas.rect(ico, 80, 80)
				ic2.position = Vector2(100, 22)
				cell.add_child(ic2)
			else:
				sw.position = Vector2(60, 24); sw.size = Vector2(80, 80)
		else:
			var no := UI.label("NONE", 34, UI.INK_SOFT, true)
			no.position = Vector2(0, 40); no.size = Vector2(200, 50)
			cell.add_child(no)
		var nm := UI.label(it["name"], 24, UI.INK, true)
		nm.position = Vector2(4, 112); nm.size = Vector2(192, 36)
		nm.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		cell.add_child(nm)
		var sub := ""
		if id == cur:
			sub = "EQUIPPED"
		elif not owned:
			var u: String = it["unlock"]
			if u == "shop": sub = "%d coins" % it["price"]
			elif u.begins_with("lvl:"): sub = "Level %s" % u.substr(4)
			elif u.begins_with("ach:"): sub = "Achievement"
		var sl := UI.label(sub, 24, UI.RED if not owned else UI.GREEN, true)
		sl.position = Vector2(0, 156); sl.size = Vector2(200, 36)
		cell.add_child(sl)
		if not owned:
			cell.modulate = Color(0.8, 0.8, 0.8)
		UI.tappable(cell, func(): _tap_item(it, owned))
		grid.add_child(cell)

func _tap_item(it: Dictionary, owned: bool) -> void:
	var id: String = it["id"]
	if not owned:
		if it["unlock"] == "shop":
			Game.confirm("BUY?", "Buy %s for %d coins?" % [it["name"], it["price"]], func():
				if Save.spend("coins", int(it["price"])):
					Save.unlock_cosmetic(id); Audio.sfx("coin"); _equip(it)
				else:
					Audio.sfx("error"); Game.toast("Not enough coins", "icon_coin"), "BUY")
		else:
			Audio.sfx("error")
			Game.toast("Unlock: " + ("reach the required level" if it["unlock"].begins_with("lvl") else "earn the achievement"), "icon_lock")
		return
	if not Save.has_cosmetic(id):
		Save.unlock_cosmetic(id)
	_equip(it)

func _equip(it: Dictionary) -> void:
	Save.data["profile"]["look"][it["cat"]] = it["id"]
	Save.mark_dirty()
	Save.stat_max("customized", 1)
	doll.look = Save.look(); doll.build()
	doll.set_state("happy"); doll.set_mood("happy")
	Audio.sfx("pop", 1.3)
	var tw := create_tween()
	tw.tween_interval(1.2)
	tw.tween_callback(func():
		if is_instance_valid(doll):
			doll.set_state("idle"); doll.set_mood("neutral"))
	_fill_grid()

func _finish_create() -> void:
	var nm := name_edit.text.strip_edges()
	if nm == "":
		nm = "Dispatcher"
	Save.data["profile"]["name"] = nm
	Save.data["flags"]["created_character"] = true
	Save.mark_dirty(); Save.save()
	Audio.sfx("levelup")
	Game.play_dialogue("welcome", func():
		Game.go("battle", {"cfg": Game.build_cfg("tutorial")}, true, false))
