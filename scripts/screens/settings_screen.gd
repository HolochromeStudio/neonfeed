extends Screen
## Settings: audio, haptics, performance/quality, accessibility, data management.

func _ready() -> void:
	music = "menu"
	super._ready()
	UI.paper_bg(self)
	add_topbar(true, "SETTINGS")
	var vp := vsize()
	var sc := ScrollContainer.new()
	sc.position = Vector2(20, Game.safe_top + 120)
	sc.size = Vector2(vp.x - 40, vp.y - Game.safe_top - 130 - Game.safe_bottom)
	sc.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	add_child(sc)
	var vb := VBoxContainer.new()
	vb.add_theme_constant_override("separation", 12)
	vb.custom_minimum_size = Vector2(vp.x - 60, 0)
	sc.add_child(vb)
	var panel := func(h: float) -> Control:
		var c := Control.new()
		c.custom_minimum_size = Vector2(vp.x - 60, h)
		var bg := Atlas.nine("ui_panel_paper", 34)
		bg.size = c.custom_minimum_size
		c.add_child(bg)
		return c
	for s in [["Music", "music"], ["Sound effects", "sfx"]]:
		var p: Control = panel.call(100)
		var l := UI.label(s[0], 38, UI.INK, true, HORIZONTAL_ALIGNMENT_LEFT)
		l.position = Vector2(30, 0); l.size = Vector2(300, 100)
		p.add_child(l)
		var sl := HSlider.new()
		sl.position = Vector2(340, 30); sl.size = Vector2(vp.x - 60 - 380, 40)
		sl.min_value = 0; sl.max_value = 1; sl.step = 0.05
		sl.value = float(Save.setting(s[1]))
		var key: String = s[1]
		sl.value_changed.connect(func(v): Save.set_setting(key, v); Audio.apply_volumes(); Audio.sfx("click"))
		p.add_child(sl)
		vb.add_child(p)
	for t in [["Haptic feedback", "haptics"], ["Screen shake", "screen_shake"], ["Damage numbers", "show_dmg"], ["Reduce motion / flashes", "reduce_motion"]]:
		var p2: Control = panel.call(100)
		var l2 := UI.label(t[0], 38, UI.INK, true, HORIZONTAL_ALIGNMENT_LEFT)
		l2.position = Vector2(30, 0); l2.size = Vector2(600, 100)
		p2.add_child(l2)
		var key2: String = t[1]
		var cb := CheckButton.new()
		cb.button_pressed = bool(Save.setting(key2))
		cb.position = Vector2(vp.x - 60 - 190, 20)
		cb.scale = Vector2(1.5, 1.5)
		cb.toggled.connect(func(on): Save.set_setting(key2, on); Audio.sfx("click"))
		p2.add_child(cb)
		vb.add_child(p2)
	var q: Control = panel.call(120)
	var ql := UI.label("Graphics quality", 38, UI.INK, true, HORIZONTAL_ALIGNMENT_LEFT)
	ql.position = Vector2(30, 0); ql.size = Vector2(400, 120)
	q.add_child(ql)
	var qrow := HBoxContainer.new()
	qrow.position = Vector2(vp.x - 60 - 520, 22)
	qrow.add_theme_constant_override("separation", 8)
	q.add_child(qrow)
	var qbtns: Dictionary = {}
	for qk in ["low", "high"]:
		var b := UI.btn(qk.to_upper(), "teal" if Save.setting("quality") == qk else "gray", Vector2(240, 76), func():
			Save.set_setting("quality", qk)
			for k in qbtns:
				qbtns[k]._color = "teal" if k == qk else "gray"; qbtns[k]._set_tex("ui_btn_%s_up" % qbtns[k]._color), 34)
		qrow.add_child(b); qbtns[qk] = b
	vb.add_child(q)
	var acts := HBoxContainer.new()
	acts.add_theme_constant_override("separation", 12)
	acts.add_child(UI.btn("REPLAY INTRO", "blue", Vector2(340, 90), func(): Game.go("intro", {}, true, false), 30))
	acts.add_child(UI.btn("REPLAY TUTORIAL", "blue", Vector2(380, 90), func(): Game.go("battle", {"cfg": Game.build_cfg("tutorial")}, true, false), 30))
	vb.add_child(acts)
	var acts2 := HBoxContainer.new()
	acts2.add_theme_constant_override("separation", 12)
	acts2.add_child(UI.btn("PROFILE", "teal", Vector2(260, 90), func(): Game.go("profile"), 32))
	acts2.add_child(UI.btn("CREDITS", "lavender", Vector2(260, 90), func(): _credits(), 32))
	acts2.add_child(UI.btn("RESET SAVE", "red", Vector2(300, 90), func(): Game.confirm("RESET EVERYTHING?", "This deletes all progress. This cannot be undone.", func(): Save.reset_all(); Game.go("boot", {}, true, false)), 30))
	vb.add_child(acts2)
	if Dev.enabled:
		vb.add_child(UI.btn("DEV MENU", "dark", Vector2(300, 80), func(): Dev.toggle_menu(), 32))
	vb.add_child(UI.label("TRAFFIC JAM 1.0  -  Godot 4  -  built from the supplied paper-collage art sheet.", 24, Color(1, 1, 1, 0.6)))

func _credits() -> void:
	var l := UI.label("TRAFFIC JAM\nDesign, code and art pipeline: Claude Code\nSource art: the supplied TRAFFIC JAM master sheet\nFonts: Lilita One, Patrick Hand, Bangers (SIL OFL)\nEngine: Godot 4", 32, UI.INK)
	l.custom_minimum_size = Vector2(760, 320)
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	Game.popup("CREDITS", l, [{"text": "OK", "color": "teal"}], Vector2(860, 640))
