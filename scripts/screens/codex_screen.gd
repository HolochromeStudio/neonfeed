extends Screen
## Knowledge page: enemies, status effects, synergies and relics.

var tab: String = "enemies"
var list: VBoxContainer
var tabs: Dictionary = {}

func _ready() -> void:
	music = "menu"
	super._ready()
	UI.paper_bg(self, "blue")
	add_topbar(true, "CODEX")
	var vp := vsize()
	var y := Game.safe_top + 120.0
	var tr := HBoxContainer.new()
	tr.position = Vector2(14, y)
	tr.add_theme_constant_override("separation", 6)
	add_child(tr)
	for t in [["enemies", "ENEMIES"], ["status", "STATUS"], ["synergy", "SYNERGY"], ["relics", "RELICS"]]:
		var b := UI.btn(t[1], "teal" if t[0] == tab else "gray", Vector2(250, 80), func(): tab = t[0]; _rebuild(); _recolor(), 30)
		tr.add_child(b)
		tabs[t[0]] = b
	var sc := ScrollContainer.new()
	sc.position = Vector2(20, y + 96)
	sc.size = Vector2(vp.x - 40, vp.y - y - 106 - Game.safe_bottom)
	sc.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	add_child(sc)
	list = VBoxContainer.new()
	list.add_theme_constant_override("separation", 10)
	list.custom_minimum_size = Vector2(vp.x - 60, 0)
	sc.add_child(list)
	_rebuild()

func _recolor() -> void:
	for k in tabs:
		var b: PaperButton = tabs[k]
		b._color = "teal" if k == tab else "gray"
		b._set_tex("ui_btn_%s_up" % b._color)

func _entry(icon_key: String, title: String, text: String, h: float = 150.0) -> Control:
	var vp := vsize()
	var r := Control.new()
	r.custom_minimum_size = Vector2(vp.x - 60, h)
	var bg := Atlas.nine("ui_panel_paper", 34)
	bg.size = r.custom_minimum_size
	r.add_child(bg)
	var ic := UI.icon(icon_key, 110, h - 30)
	ic.position = Vector2(24, 15)
	r.add_child(ic)
	var t := UI.label(title, 36, UI.INK, true, HORIZONTAL_ALIGNMENT_LEFT)
	t.position = Vector2(160, 8); t.size = Vector2(r.custom_minimum_size.x - 190, 44)
	r.add_child(t)
	var d := UI.label(text, 26, UI.INK_SOFT, false, HORIZONTAL_ALIGNMENT_LEFT)
	d.position = Vector2(160, 52); d.size = Vector2(r.custom_minimum_size.x - 190, h - 60)
	d.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	d.custom_minimum_size = Vector2(r.custom_minimum_size.x - 190, 0)
	r.add_child(d)
	return r

func _rebuild() -> void:
	for c in list.get_children():
		c.queue_free()
	match tab:
		"enemies":
			for id in Data.enemies:
				var e: Dictionary = Data.enemies[id]
				list.add_child(_entry(e["art"], e["name"], "%s  HP %d  Speed %d  City damage %d" % [e["blurb"], int(e["hp"]), int(e["speed"]), int(e["leak"])]))
			for id in Data.bosses:
				var b: Dictionary = Data.bosses[id]
				list.add_child(_entry(b["art"], "BOSS: %s (%s)" % [b["name"], b["title"]], b["blurb"], 170))
		"status":
			for id in Data.statuses:
				var s: Dictionary = Data.statuses[id]
				list.add_child(_entry(s["icon"], s["name"], s["desc"], 120))
			list.add_child(UI.label("Combos: WET + SHOCK = chain damage. OIL + BURN = stronger fire. MARKED + POLICE = priority bonus.", 28, Color(1, 1, 1, 0.85)))
		"synergy":
			for s in Data.synergies:
				for tier in s["tiers"]:
					list.add_child(_entry("icon_rank_shield", "%s (%d)" % [tier["name"], tier["n"]], tier["desc"], 120))
		"relics":
			for r in Data.relics:
				var seen: bool = r["id"] in Save.data["relics_seen"]
				list.add_child(_entry("icon_crown" if seen else "icon_lock", r["name"] if seen else "???", (r["desc"] + "\n\"" + r["flavor"] + "\"") if seen else "Find this relic in a run to reveal it.", 150))
