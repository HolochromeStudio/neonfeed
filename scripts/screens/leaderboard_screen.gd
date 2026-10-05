extends Screen
## Local leaderboards (offline): the player vs. the cast of the story. Scores are seeded from the date.

var tab: String = "survival"
var list: VBoxContainer
var tabs: Dictionary = {}
const NAMES := ["Vince Vortex", "Rita Reel", "Officer Dana", "Gus", "Hardhat Hank", "Dex", "Mayor P.", "Biscuit", "The Stranger", "Rookie Rita", "Taxi Tom", "Bus Betty", "Plow Pete", "Cone Carl", "Jam Jess"]

func _ready() -> void:
	music = "menu"
	super._ready()
	UI.paper_bg(self, "blue")
	add_topbar(true, "LEADERBOARD")
	var vp := vsize()
	var y := Game.safe_top + 120.0
	var tr := HBoxContainer.new()
	tr.position = Vector2(20, y)
	tr.add_theme_constant_override("separation", 10)
	add_child(tr)
	for t in [["survival", "SURVIVAL"], ["pvp", "PVP RATING"], ["level", "LEVEL"]]:
		var b := UI.btn(t[1], "orange" if t[0] == tab else "gray", Vector2(330, 84), func(): tab = t[0]; _rebuild(); _recolor(), 34)
		tr.add_child(b)
		tabs[t[0]] = b
	var sc := ScrollContainer.new()
	sc.position = Vector2(20, y + 100)
	sc.size = Vector2(vp.x - 40, vp.y - y - 110 - Game.safe_bottom)
	sc.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	add_child(sc)
	list = VBoxContainer.new()
	list.add_theme_constant_override("separation", 8)
	list.custom_minimum_size = Vector2(vp.x - 60, 0)
	sc.add_child(list)
	_rebuild()

func _recolor() -> void:
	for k in tabs:
		var b: PaperButton = tabs[k]
		b._color = "orange" if k == tab else "gray"
		b._set_tex("ui_btn_%s_up" % b._color)

func _rebuild() -> void:
	for c in list.get_children():
		c.queue_free()
	var rng := RandomNumberGenerator.new()
	rng.seed = hash(Save.today() + tab)
	var rows: Array = []
	for n in NAMES:
		var v := 0
		match tab:
			"survival": v = rng.randi_range(6, 38)
			"pvp": v = rng.randi_range(850, 1700)
			"level": v = rng.randi_range(3, 45)
		rows.append({"name": n, "v": v, "me": false})
	var mine := 0
	match tab:
		"survival": mine = int(Save.data["survival"]["best_wave"])
		"pvp": mine = int(Save.data["pvp"]["rating"])
		"level": mine = Save.player_level()
	rows.append({"name": String(Save.data["profile"]["name"]), "v": mine, "me": true})
	rows.sort_custom(func(a, b): return a["v"] > b["v"])
	var vp := vsize()
	for i in rows.size():
		var r: Dictionary = rows[i]
		var h := Control.new()
		h.custom_minimum_size = Vector2(vp.x - 60, 96)
		var bg := Atlas.nine("ui_panel_yellow" if r["me"] else "ui_panel_paper", 30)
		bg.size = h.custom_minimum_size
		h.add_child(bg)
		var rk := UI.label("#%d" % (i + 1), 42, UI.RED if i < 3 else UI.INK, true)
		rk.position = Vector2(10, 0); rk.size = Vector2(110, 96)
		h.add_child(rk)
		if i < 3:
			var tr := UI.icon("icon_trophy", 56); tr.position = Vector2(120, 20); h.add_child(tr)
		var nm := UI.label(r["name"], 40, UI.INK, true, HORIZONTAL_ALIGNMENT_LEFT)
		nm.position = Vector2(190, 0); nm.size = Vector2(500, 96)
		h.add_child(nm)
		var sv := UI.label(("Wave %d" % r["v"]) if tab == "survival" else str(r["v"]), 42, UI.INK, true, HORIZONTAL_ALIGNMENT_RIGHT)
		sv.position = Vector2(h.custom_minimum_size.x - 330, 0); sv.size = Vector2(300, 96)
		h.add_child(sv)
		list.add_child(h)
