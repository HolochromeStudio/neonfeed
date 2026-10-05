extends Node
## Scene router, overlays, run lifecycle and reward processing.

const SCREENS := {
	"boot": "res://scripts/screens/boot_screen.gd",
	"title": "res://scripts/screens/title_screen.gd",
	"intro": "res://scripts/screens/intro_screen.gd",
	"create": "res://scripts/screens/create_screen.gd",
	"home": "res://scripts/screens/home_screen.gd",
	"modes": "res://scripts/screens/modes_screen.gd",
	"map": "res://scripts/screens/map_screen.gd",
	"units": "res://scripts/screens/units_screen.gd",
	"customize": "res://scripts/screens/customize_screen.gd",
	"quests": "res://scripts/screens/quests_screen.gd",
	"shop": "res://scripts/screens/shop_screen.gd",
	"inventory": "res://scripts/screens/inventory_screen.gd",
	"leaderboard": "res://scripts/screens/leaderboard_screen.gd",
	"settings": "res://scripts/screens/settings_screen.gd",
	"profile": "res://scripts/screens/profile_screen.gd",
	"battle": "res://scripts/screens/battle_screen.gd",
	"results": "res://scripts/screens/results_screen.gd",
	"cutscene": "res://scripts/screens/cutscene_screen.gd",
	"codex": "res://scripts/screens/codex_screen.gd",
}

var root: Node
var screen_layer: CanvasLayer
var overlay: CanvasLayer
var trans_layer: CanvasLayer
var screen_holder: Control
var current: Control
var screen_name: String = ""
var history: Array = []
var safe_top: float = 0.0
var safe_bottom: float = 0.0
var _transitioning: bool = false
var _curtain: NinePatchRect
var _scripts: Dictionary = {}
var toast_box: VBoxContainer

signal screen_changed(name: String)

func setup(main: Node) -> void:
	root = main
	screen_layer = CanvasLayer.new(); screen_layer.layer = 0; main.add_child(screen_layer)
	screen_holder = Control.new()
	UI.set_full_rect(screen_holder)
	screen_holder.mouse_filter = Control.MOUSE_FILTER_IGNORE
	screen_layer.add_child(screen_holder)
	overlay = CanvasLayer.new(); overlay.layer = 50; main.add_child(overlay)
	trans_layer = CanvasLayer.new(); trans_layer.layer = 100; main.add_child(trans_layer)
	toast_box = VBoxContainer.new()
	toast_box.set_anchors_and_offsets_preset(Control.PRESET_CENTER_TOP)
	toast_box.position.y = 200
	toast_box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	overlay.add_child(toast_box)
	get_viewport().size_changed.connect(_update_safe)
	_update_safe()

func _update_safe() -> void:
	var win := DisplayServer.window_get_size()
	var safe := DisplayServer.get_display_safe_area()
	var vp := get_viewport().get_visible_rect().size
	if win.y > 0 and safe.size.y > 0 and safe.size.y < win.y:
		var k := vp.y / float(win.y)
		safe_top = maxf(0.0, float(safe.position.y) * k)
		safe_bottom = maxf(0.0, float(win.y - safe.end.y) * k)
	else:
		safe_top = 24.0 if OS.has_feature("mobile") else 8.0
		safe_bottom = 20.0 if OS.has_feature("mobile") else 8.0

func _get_script(name: String) -> GDScript:
	if not _scripts.has(name):
		_scripts[name] = load(SCREENS[name])
	return _scripts[name]

## Navigate. `push` keeps history so back() works.
func go(name: String, a: Dictionary = {}, transition: bool = true, push: bool = true) -> void:
	if _transitioning:
		return
	if name == screen_name and current != null and name != "battle":
		pass
	if push and screen_name != "" and screen_name not in ["boot", "battle", "results", "cutscene", "intro"]:
		history.append({"name": screen_name, "args": current.args if current else {}})
	if history.size() > 12:
		history.pop_front()
	if not transition or current == null:
		_swap(name, a)
		return
	_transitioning = true
	_ensure_curtain()
	var h := get_viewport().get_visible_rect().size.y
	_curtain.position.y = h
	_curtain.visible = true
	var tw := create_tween()
	Audio.sfx("whoosh", 1.1, -6)
	tw.tween_property(_curtain, "position:y", 0.0, 0.26).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	tw.tween_callback(func(): _swap(name, a))
	tw.tween_interval(0.05)
	tw.tween_property(_curtain, "position:y", -h - 40.0, 0.3).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_IN)
	tw.tween_callback(func():
		_curtain.visible = false
		_transitioning = false)

func back() -> void:
	if history.is_empty():
		go("home", {}, true, false)
		return
	var h: Dictionary = history.pop_back()
	go(h["name"], h["args"], true, false)

func _ensure_curtain() -> void:
	if _curtain:
		return
	var vp := get_viewport().get_visible_rect().size
	_curtain = Atlas.nine("ui_panel_kraft", 60)
	_curtain.size = vp + Vector2(160, 160)
	_curtain.position = Vector2(-80, vp.y)
	trans_layer.add_child(_curtain)
	_curtain.visible = false
	var tape := TextureRect.new()
	tape.texture = Atlas.tex("ui_tape")
	tape.position = Vector2(vp.x * 0.5 - 100, 60)
	tape.size = Vector2(200, 64)
	tape.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_curtain.add_child(tape)
	var logo := TextureRect.new()
	logo.texture = Atlas.tex("logo_cone")
	logo.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	logo.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	logo.size = Vector2(220, 300)
	logo.position = Vector2(vp.x * 0.5 - 110 + 80, vp.y * 0.5 - 150 + 80)
	_curtain.add_child(logo)
	get_viewport().size_changed.connect(func():
		var v2 := get_viewport().get_visible_rect().size
		if _curtain:
			_curtain.size = v2 + Vector2(160, 160))

func _swap(name: String, a: Dictionary) -> void:
	if current:
		current.queue_free()
	var s: Control = _get_script(name).new()
	s.init(a)
	screen_holder.add_child(s)
	current = s
	screen_name = name
	screen_changed.emit(name)

# ------------------------------------------------------------------ overlays
func add_overlay(c: Control) -> void:
	overlay.add_child(c)

func toast(text: String, icon_key: String = "", color: String = "dark") -> void:
	var root_c := Control.new()
	root_c.custom_minimum_size = Vector2(760, 86)
	root_c.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var vp := get_viewport().get_visible_rect().size
	var bg := Atlas.nine("ui_panel_" + color, 36)
	bg.size = Vector2(760, 86)
	root_c.add_child(bg)
	var l := UI.label(text, 32, UI.WHITE, true)
	l.size = Vector2(760, 86)
	if icon_key != "":
		l.position.x = 50
		var ic := UI.icon(icon_key, 56)
		ic.position = Vector2(30, 15)
		root_c.add_child(ic)
	root_c.add_child(l)
	toast_box.position.x = vp.x * 0.5 - 380
	toast_box.add_child(root_c)
	root_c.modulate.a = 0.0
	var tw := root_c.create_tween()
	tw.tween_property(root_c, "modulate:a", 1.0, 0.2)
	tw.tween_interval(2.2)
	tw.tween_property(root_c, "modulate:a", 0.0, 0.4)
	tw.tween_callback(root_c.queue_free)
	Audio.sfx("tick")

## Modal dialog helper. Returns the Popup so callers can add content.
func popup(title: String, body: Control = null, buttons: Array = [], size: Vector2 = Vector2(860, 700)) -> PaperPopup:
	var p := PaperPopup.new()
	overlay.add_child(p)
	p.build(title, body, buttons, size)
	return p

func confirm(title: String, text: String, on_yes: Callable, yes_text: String = "YES", no_text: String = "CANCEL") -> void:
	var body := UI.label(text, 36, UI.INK, false)
	body.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	body.custom_minimum_size = Vector2(700, 200)
	popup(title, body, [{"text": no_text, "color": "gray"}, {"text": yes_text, "color": "green", "cb": on_yes}], Vector2(860, 520))

func play_dialogue(scene_id: String, on_done: Callable = Callable()) -> void:
	var d := DialogueBox.new()
	d.start(scene_id, on_done)
	overlay.add_child(d)

# ------------------------------------------------------------------ run lifecycle
var last_cfg: Dictionary = {}
var last_summary: Dictionary = {}

func build_cfg(mode: String, p: Dictionary = {}) -> Dictionary:
	var cfg := {"mode": mode, "seed": int(Time.get_ticks_usec() % 1000000), "deck": Save.active_deck().duplicate(), "levels": Save.levels_map(),
		"city_hp": 20, "start_sp": 50, "cols": 5, "rows": 3, "first_offer": 2, "boosters": p.get("boosters", [])}
	for b in cfg["boosters"]:
		match b:
			"rush_ticket": cfg["bonus_sp"] = 30
			"spare_tire": cfg["city_hp"] += 6
	match mode:
		"story":
			var ch: Dictionary = Data.chapters[int(p["chapter"]) - 1]
			var lv: Dictionary = ch["levels"][int(p["level"]) - 1]
			cfg.merge({"chapter": ch["id"], "level": lv["level"], "level_id": lv["id"], "waves": lv["waves"], "boss": lv["boss"], "biome": ch["biome"],
				"enemy_pool": ch["pool"], "difficulty": lv["difficulty"], "title": lv["name"]}, true)
		"survival":
			var order := ["city_center", "suburbs", "highway", "industrial", "desert", "snow_town", "beach_road", "countryside", "night_city"]
			cfg.merge({"chapter": 3, "waves": 0, "boss": "", "biome": p.get("biome", "city_center"), "enemy_pool": ["slow_car", "speedster", "suv", "truck", "bus", "gang_cars", "police_chase", "motorcycle", "road_cleaner", "armored_truck"],
				"difficulty": 1.0, "title": "SURVIVAL", "hp_base": 1.1}, true)
			if p.has("biome"):
				cfg["biome"] = p["biome"]
			else:
				cfg["biome"] = order[randi() % order.size()]
		"tutorial":
			cfg.merge({"chapter": 1, "waves": 3, "boss": "", "biome": "city_center", "enemy_pool": ["slow_car", "speedster"], "difficulty": 0.6, "title": "TUTORIAL", "tutorial": true,
				"deck": MetaData.STARTER_DECK.duplicate(), "seed": 4242, "city_hp": 20}, true)
		"pvp":
			cfg.merge({"chapter": 3, "waves": 12, "boss": "", "biome": "highway", "enemy_pool": ["slow_car", "speedster", "suv", "truck", "bus", "gang_cars", "police_chase"],
				"difficulty": 1.0, "title": "PvP DUEL", "no_upgrades": false}, true)
			cfg["opponent"] = p.get("opponent", {})
		"coop":
			cfg.merge({"chapter": 4, "waves": 16, "boss": "tank", "biome": "industrial", "enemy_pool": ["slow_car", "speedster", "suv", "truck", "bus", "gang_cars", "police_chase", "armored_truck"],
				"difficulty": 1.1, "title": "CO-OP", "rows": 6, "cell": Vector2(150, 140), "coop": true, "budget_mult": 1.7,
				"partner_deck": p.get("partner_deck", ["police", "fire_engine", "ambulance", "tow_truck", "school_bus"])}, true)
	return cfg

func start_run(cfg: Dictionary) -> void:
	last_cfg = cfg
	for b in cfg.get("boosters", []):
		Save.data["inventory"][b] = maxi(0, int(Save.data["inventory"].get(b, 0)) - 1)
	Save.mark_dirty()
	go("battle", {"cfg": cfg}, true, false)

## Called by the battle screen when the sim ended. Applies rewards/stats and shows Results.
func finish_run(summary: Dictionary, cfg: Dictionary) -> void:
	last_summary = summary
	var rewards := process_rewards(summary, cfg)
	go("results", {"summary": summary, "cfg": cfg, "rewards": rewards}, true, false)

func process_rewards(s: Dictionary, cfg: Dictionary) -> Dictionary:
	var win: bool = s["result"] == "victory"
	var mode: String = cfg["mode"]
	var r := {"coins": 0, "xp": 0, "gems": 0, "cards": {}, "unlock": "", "stars": 0, "first_clear": false, "new_best": false, "items": []}
	var waves := int(s["wave"])
	Save.stat_add("kills", int(s["kills"]))
	Save.stat_add("merges", int(s["merges"]))
	Save.stat_add("deploys", int(s["deploys"]))
	Save.stat_add("waves", waves)
	Save.stat_add("upgrades", int(s["upgrades"]))
	Save.stat_add("elites", int(s["elites"]))
	Save.stat_add("bosses", int(s["bosses"]) if win or true else 0)
	Save.stat_add("crits", int(s.get("crits", 0)))
	Save.stat_add("relics", int(s.get("relics", 0)))
	Save.stat_max("max_rank", int(s["max_rank"]))
	Save.stat_max("max_synergies", int(s.get("max_synergies", 0)))
	Save.stat_add("runs", 1)
	if win:
		Save.stat_add("wins", 1)
		if int(s["leaks"]) == 0 and mode == "story":
			Save.stat_add("perfect_wins", 1)
	match mode:
		"story":
			var lid: String = cfg["level_id"]
			var L: Dictionary = Data.chapters[int(cfg["chapter"]) - 1]["levels"][int(cfg["level"]) - 1]
			if win:
				var frac := float(s["city_hp"]) / float(maxi(1, cfg.get("city_hp", 20)))
				r["stars"] = 3 if frac >= 0.9 else (2 if frac >= 0.5 else 1)
				var first := not Save.level_cleared(lid)
				r["first_clear"] = first
				var old: Dictionary = Save.level_info(lid)
				Save.data["campaign"]["cleared"][lid] = {"stars": maxi(int(old.get("stars", 0)), r["stars"]), "best_wave": waves}
				r["coins"] = int(L["coins"]) * (1 if not first else 2)
				r["xp"] = int(L["xp"])
				if first and L["unlock"] != "":
					if Save.unlock_unit(L["unlock"]):
						r["unlock"] = L["unlock"]
				if first and int(cfg["level"]) == 6:
					Save.data["campaign"]["chapter_cleared"][str(cfg["chapter"])] = true
					Save.stat_max("chapters_cleared", Save.chapters_cleared())
					r["gems"] += 10
				# cards for deck units
				for id in cfg["deck"]:
					var n := int(L["cards"]) + (1 if r["stars"] == 3 else 0)
					Save.add_cards(id, n)
					r["cards"][id] = n
				r["gems"] += (2 if r["stars"] == 3 else 0)
			else:
				r["coins"] = 8 * waves
				r["xp"] = 6 * waves
		"survival":
			r["coins"] = 10 * waves + 3 * int(s["bosses"]) * 20
			r["xp"] = 8 * waves
			var best: int = int(Save.data["survival"]["best_wave"])
			Save.data["survival"]["runs"] += 1
			if waves > best:
				Save.data["survival"]["best_wave"] = waves
				Save.data["survival"]["best_time"] = float(s["time"])
				r["new_best"] = true
			Save.stat_max("survival_best", waves)
			if waves >= 10:
				r["gems"] += waves / 10
			for id in cfg["deck"]:
				if randf() < 0.4:
					Save.add_cards(id, 1 + waves / 12); r["cards"][id] = 1 + waves / 12
		"pvp":
			Save.stat_add("pvp_played", 1)
			var delta := 25 if win else -18
			Save.data["pvp"]["rating"] = maxi(100, int(Save.data["pvp"]["rating"]) + delta)
			r["rating_delta"] = delta
			if win:
				Save.data["pvp"]["wins"] += 1; Save.data["pvp"]["streak"] += 1
				Save.stat_add("pvp_wins", 1)
			else:
				Save.data["pvp"]["losses"] += 1; Save.data["pvp"]["streak"] = 0
			r["coins"] = (160 if win else 50)
			r["xp"] = 40 if win else 15
			r["gems"] = 1 if win else 0
		"coop":
			Save.stat_add("coop_played", 1)
			if win:
				Save.stat_add("coop_wins", 1); Save.data["coop"]["wins"] += 1
			else:
				Save.data["coop"]["losses"] += 1
			r["coins"] = 140 if win else 40 + 6 * waves
			r["xp"] = 45 if win else 15
			r["gems"] = 2 if win else 0
		"tutorial":
			r["coins"] = 150; r["xp"] = 60; r["gems"] = 5
			Save.data["flags"]["tutorial_done"] = true
			Save.stat_add("tutorial_done", 1)
			Save.unlock_unit("hatchback")
			r["unlock"] = "hatchback"
	if Save.data["inventory"].get("lucky_dice", 0) > 0 and "lucky_dice" in cfg.get("boosters", []):
		r["coins"] = int(r["coins"] * 1.5)
	Save.add_wallet("coins", r["coins"]); Save.add_wallet("gems", r["gems"])
	r["levelups"] = Save.add_xp(r["xp"])
	Save.mark_dirty()
	Save.save()
	return r

## --goto=<screen> [--args=k:v,...] support for tests / screenshots.
func dev_goto() -> void:
	var a: Dictionary = Dev.goto_args.duplicate()
	var name: String = Dev.goto_screen
	if not Save.data["flags"]["created_character"]:
		Save.data["flags"]["created_character"] = true; Save.data["flags"]["intro_seen"] = true
	if name == "battle":
		var m: String = a.get("mode", "story")
		var cfg := build_cfg(m, {"chapter": int(a.get("ch", 1)), "level": int(a.get("lv", 1))})
		if a.has("seed"):
			cfg["seed"] = int(a["seed"])
		if a.has("deck"):
			cfg["deck"] = String(a["deck"]).split("+")
		if a.has("sp"):
			cfg["start_sp"] = int(a["sp"])
		if a.has("hp"):
			cfg["city_hp"] = int(a["hp"])
		last_cfg = cfg
		go("battle", {"cfg": cfg}, false, false)
	else:
		go(name, a, false, false)
