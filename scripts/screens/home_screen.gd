extends Screen
## Hub: player doll on a living street, big PLAY, and the eight menu buttons from the style sheet.

var _road: RoadScene
var _doll: Doll
var _t: float = 0.0
var _doll_t: float = 3.0
var _buttons: Dictionary = {}

func _ready() -> void:
	music = "menu"
	super._ready()
	var vp := vsize()
	var look: Dictionary = RoadScene.BIOME_LOOK.get(_biome(), RoadScene.BIOME_LOOK["city_center"])
	var sky := ColorRect.new()
	sky.color = look["sky"]
	UI.set_full_rect(sky)
	add_child(sky)
	var sk := Atlas.rect("biome_" + _biome(), vp.x, 560)
	sk.stretch_mode = TextureRect.STRETCH_SCALE
	sk.position = Vector2(0, 120)
	sk.modulate = Color(1.18, 1.16, 1.1)
	add_child(sk)
	var cover := Control.new()
	cover.clip_contents = true
	cover.position = Vector2(0, vp.y * 0.60)
	cover.size = Vector2(vp.x, vp.y * 0.4)
	add_child(cover)
	_road = RoadScene.new()
	_road.size = Vector2(vp.x, vp.y * 0.6)
	add_child(_road)
	_road.setup(_biome(), vp.y * 0.30 + 220, 250)
	_road.car_ids = Save.data["units"].keys()
	_road.speed = 60.0
	var cbg := UI.paper_bg(cover, "sun")
	cbg.position = Vector2(0, -vp.y * 0.60)
	cbg.size = vp
	# doll
	_doll = Doll.new()
	_doll.scale = Vector2(1.25, 1.25)
	_doll.position = Vector2(vp.x * 0.5 - 20, vp.y * 0.30 + 205)
	add_child(_doll)
	_doll.set_state("idle")
	# dog sidekick
	var dog := Atlas.sprite("npc_animal_dog", true)
	dog.position = Vector2(vp.x * 0.5 + 170, vp.y * 0.30 + 215)
	dog.scale = Vector2(-1.1, 1.1)
	add_child(dog)
	var dtw := create_tween().set_loops()
	dtw.tween_property(dog, "rotation", 0.06, 0.4).set_trans(Tween.TRANS_SINE)
	dtw.tween_property(dog, "rotation", -0.04, 0.4).set_trans(Tween.TRANS_SINE)
	_build_top()
	_build_menu()
	_build_play()
	Save.refresh_quests()
	_update_badges()
	if Save.daily_reward_available() and not OS.has_environment("TJ_NODAILY"):
		var t := create_tween()
		t.tween_interval(0.6)
		t.tween_callback(_show_daily)

func _biome() -> String:
	var nl := Save.next_level().split("-")
	var ch: int = int(nl[0])
	return Data.chapters[ch - 1]["biome"]

func _build_top() -> void:
	var vp := vsize()
	var top := Game.safe_top + 10.0
	# profile card
	var pc := Atlas.nine("ui_panel_paper", 40)
	pc.size = Vector2(560, 120)
	pc.position = Vector2(20, top)
	add_child(pc)
	pc.mouse_filter = Control.MOUSE_FILTER_STOP
	pc.gui_input.connect(func(ev):
		if ev is InputEventMouseButton and ev.pressed:
			Audio.sfx("click"); Game.go("profile"))
	var name_l := UI.label(String(Save.data["profile"]["name"]), 40, UI.INK, true, HORIZONTAL_ALIGNMENT_LEFT)
	name_l.position = Vector2(30, 8); name_l.size = Vector2(340, 50)
	pc.add_child(name_l)
	var lv := UI.label("LV %d" % Save.player_level(), 34, UI.RED, true, HORIZONTAL_ALIGNMENT_RIGHT)
	lv.position = Vector2(370, 10); lv.size = Vector2(170, 46)
	pc.add_child(lv)
	var bbg := Atlas.nine("ui_bar_bg", 20)
	bbg.size = Vector2(500, 28); bbg.position = Vector2(30, 70)
	pc.add_child(bbg)
	var xf := float(Save.data["profile"]["xp"]) / float(Save.xp_needed(Save.player_level()))
	var xb := Atlas.nine("ui_bar_fill_blue", 20)
	xb.size = Vector2(maxf(22.0, 500.0 * xf), 28); xb.position = bbg.position
	pc.add_child(xb)
	var coin := UI.resource_pill("coins", 200); coin.position = Vector2(vp.x - 20 - 200, top)
	var gem := UI.resource_pill("gems", 200); gem.position = Vector2(vp.x - 20 - 200, top + 72)
	add_child(coin); add_child(gem)
	var tk := UI.resource_pill("tickets", 130); tk.position = Vector2(vp.x - 20 - 200 - 140, top)
	add_child(tk)
	# daily reward button
	var dr := UI.btn("", "yellow", Vector2(120, 100), func(): _show_daily(), 30, "icon_calendar")
	dr.position = Vector2(vp.x - 20 - 340, top + 72) if false else Vector2(20, top + 134)
	add_child(dr)
	_buttons["daily"] = dr

func _build_play() -> void:
	var vp := vsize()
	var play := UI.btn("PLAY", "green", Vector2(760, 170), func(): Game.go("modes"), 96)
	play.position = Vector2((vp.x - 760) * 0.5, vp.y * 0.60 + 10)
	add_child(play)
	UI.pop_in(play, 0.2)
	var tw := create_tween().set_loops()
	tw.tween_property(play, "scale", Vector2(1.025, 1.025), 0.6).set_trans(Tween.TRANS_SINE)
	tw.tween_property(play, "scale", Vector2(1.0, 1.0), 0.6).set_trans(Tween.TRANS_SINE)
	var nl: String = Save.next_level()
	var sub := UI.label("Next: Chapter %s  -  %s" % [nl, Data.chapters[int(nl.split("-")[0]) - 1]["name"]], 34, UI.WHITE, true, HORIZONTAL_ALIGNMENT_CENTER, 7)
	sub.position = Vector2(0, vp.y * 0.60 + 188)
	sub.size = Vector2(vp.x, 44)
	add_child(sub)

func _build_menu() -> void:
	var vp := vsize()
	var defs := [
		["SHOP", "yellow", "shop", "icon_coin"], ["UNITS", "blue", "units", "icon_pump"],
		["QUESTS", "red", "quests", "icon_star"], ["CUSTOMIZE", "mint", "customize", "icon_crown"],
		["INVENTORY", "orange", "inventory", "icon_jerrycan"], ["LEADERBOARD", "orange", "leaderboard", "icon_trophy"],
		["SETTINGS", "lavender", "settings", "icon_gear"], ["CODEX", "teal", "codex", "icon_mail"],
	]
	var y0 := vp.y * 0.60 + 260
	var bw := 480.0
	var bh := 110.0
	var gx := 40.0
	var rows := 4
	var avail := vp.y - y0 - Game.safe_bottom - 20
	var gy := minf(24.0, (avail - rows * bh) / float(rows))
	for i in defs.size():
		var d: Array = defs[i]
		var col := i % 2
		var row := i / 2
		var b := UI.btn(d[0], d[1], Vector2(bw, bh), func(): Game.go(d[2]), 44 if d[0].length() < 10 else 38, d[3])
		b.position = Vector2(vp.x * 0.5 - bw - gx * 0.5 + col * (bw + gx), y0 + row * (bh + gy))
		add_child(b)
		UI.pop_in(b, 0.1 + 0.05 * i)
		_buttons[d[2]] = b

func _update_badges() -> void:
	var qb: PaperButton = _buttons["quests"]
	var n := Save.unclaimed_achievements()
	for lst in [Save.data["quests"]["daily"], Save.data["quests"]["weekly"]]:
		for it in lst:
			if int(it["progress"]) >= int(it["n"]) and not it["claimed"]:
				n += 1
	if n > 0:
		qb.add_badge(str(n))
	var ub: PaperButton = _buttons["units"]
	var up := 0
	for id in Save.data["units"]:
		if Save.can_upgrade(id):
			up += 1
	if up > 0:
		ub.add_badge(str(up))
	var sb: PaperButton = _buttons["shop"]
	if Save.coins() >= 300:
		sb.add_badge("!")
	if Save.daily_reward_available() and not OS.has_environment("TJ_NODAILY"):
		(_buttons["daily"] as PaperButton).add_badge("!")

func _process(dt: float) -> void:
	_t += dt
	_doll_t -= dt
	if _doll_t <= 0.0:
		_doll_t = randf_range(3.0, 6.0)
		var st: String = ["happy", "think", "look", "idle", "point"][randi() % 5]
		_doll.set_state(st); _doll.set_mood({"happy": "happy", "think": "think", "look": "look", "idle": "neutral", "point": "point"}[st])
		var tw := create_tween()
		tw.tween_interval(1.6)
		tw.tween_callback(func():
			_doll.set_state("idle"); _doll.set_mood("neutral"))

func _show_daily() -> void:
	if not Save.daily_reward_available():
		Game.toast("Come back tomorrow for the next reward!", "icon_calendar")
		return
	var body := VBoxContainer.new()
	body.add_theme_constant_override("separation", 14)
	var streak := int(Save.data["daily_reward"]["streak"])
	var grid := GridContainer.new()
	grid.columns = 7
	grid.add_theme_constant_override("h_separation", 8)
	for d in 7:
		var cell := Control.new()
		cell.custom_minimum_size = Vector2(100, 130)
		var cur := d == streak % 7
		var bg := Atlas.nine("ui_panel_yellow" if cur else ("ui_panel_green" if d < streak % 7 else "ui_panel_gray"), 24)
		bg.size = Vector2(100, 130)
		cell.add_child(bg)
		var dl := UI.label("DAY %d" % (d + 1), 20, UI.INK, true)
		dl.size = Vector2(100, 28); dl.position = Vector2(0, 6)
		cell.add_child(dl)
		var amt: int = [50, 75, 100, 150, 200, 300, 500][d]
		var ic := UI.icon("icon_coin" if [0, 0, 1, 0, 2, 0, 5][d] == 0 else "icon_gem", 52)
		ic.position = Vector2(24, 40)
		cell.add_child(ic)
		var al := UI.label(str(amt) if [0, 0, 1, 0, 2, 0, 5][d] == 0 else "x%d" % [0, 0, 1, 0, 2, 0, 5][d], 28, UI.INK, true)
		al.size = Vector2(100, 34); al.position = Vector2(0, 92)
		cell.add_child(al)
		grid.add_child(cell)
	body.add_child(grid)
	body.add_child(UI.label("Log in every day for bigger rewards!", 32, UI.INK_SOFT))
	var p := Game.popup("DAILY REWARD", body, [{"text": "CLAIM!", "color": "green", "cb": func():
		var r := Save.claim_daily_reward()
		Audio.sfx("coin")
		Game.toast("+%d coins%s" % [r["coins"], (" +%d gems" % r["gems"]) if r["gems"] > 0 else ""], "icon_coin")
		(_buttons["daily"] as PaperButton).clear_badge()}], Vector2(860, 620))
