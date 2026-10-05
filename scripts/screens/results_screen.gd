extends Screen
## Post-run results: stamp, stars, stats, rewards with count-up, unit unlock reveal, next actions.

var summary: Dictionary
var cfg: Dictionary
var rewards: Dictionary
var _t: float = 0.0
var _coin_label: Label
var _xp_bar: NinePatchRect
var _count: float = 0.0
var _lvl_label: Label

func init(a: Dictionary) -> void:
	args = a
	summary = a["summary"]; cfg = a["cfg"]; rewards = a["rewards"]

func _ready() -> void:
	music = "menu"
	super._ready()
	var win: bool = summary["result"] == "victory"
	var mode: String = cfg["mode"]
	var vp := vsize()
	UI.paper_bg(self, "sun" if win else "blue")
	var road := RoadScene.new()
	road.size = Vector2(vp.x, 260)
	road.position = Vector2(0, vp.y - 360)
	add_child(road)
	road.setup(cfg.get("biome", "city_center"), 40, 150)
	var y := Game.safe_top + 40.0
	var rb := Atlas.nine("ui_ribbon_" + ("teal" if win else "red"), 22)
	rb.size = Vector2(vp.x - 80, 150)
	rb.position = Vector2(40, y)
	add_child(rb)
	var tl := UI.label("VICTORY!" if win else ("RUN OVER" if mode != "survival" else "SURVIVED %d WAVES" % int(summary["wave"])), 92 if mode != "survival" else 64, UI.WHITE, true, HORIZONTAL_ALIGNMENT_CENTER, 12)
	tl.size = rb.size
	rb.add_child(tl)
	UI.stamp(rb)
	y += 170
	var sub := cfg.get("title", "")
	var st := UI.label(String(sub), 44, UI.WHITE, true, HORIZONTAL_ALIGNMENT_CENTER, 8)
	st.position = Vector2(0, y); st.size = Vector2(vp.x, 60)
	add_child(st)
	y += 70
	if mode == "story" and win:
		var row := HBoxContainer.new()
		row.alignment = BoxContainer.ALIGNMENT_CENTER
		row.position = Vector2(0, y); row.size = Vector2(vp.x, 130)
		row.add_theme_constant_override("separation", 20)
		add_child(row)
		for i in 3:
			var star := UI.icon("ui_star_gold" if i < int(rewards["stars"]) else "ui_star_gray", 120)
			row.add_child(star)
			star.pivot_offset = Vector2(60, 60)
			star.scale = Vector2.ZERO
			var tw := create_tween()
			tw.tween_interval(0.5 + i * 0.35)
			tw.tween_property(star, "scale", Vector2(1.3, 1.3), 0.2).set_trans(Tween.TRANS_BACK)
			tw.tween_property(star, "scale", Vector2.ONE, 0.12)
			if i < int(rewards["stars"]):
				tw.tween_callback(func(): Audio.sfx("stamp", 1.0 + 0.15 * i))
		y += 140
	elif mode == "pvp":
		var d := int(rewards.get("rating_delta", 0))
		var rl := UI.label("RATING %s%d  (%d)" % ["+" if d >= 0 else "", d, int(Save.data["pvp"]["rating"])], 56, UI.YELLOW, true, HORIZONTAL_ALIGNMENT_CENTER, 10)
		rl.position = Vector2(0, y); rl.size = Vector2(vp.x, 80)
		add_child(rl)
		y += 100
	elif mode == "survival" and rewards.get("new_best", false):
		var nb := UI.label("NEW PERSONAL BEST!", 56, UI.YELLOW, true, HORIZONTAL_ALIGNMENT_CENTER, 10)
		nb.position = Vector2(0, y); nb.size = Vector2(vp.x, 80)
		add_child(nb)
		UI.pop_in(nb, 0.6)
		y += 100
	# stats card
	var card := UI.panel("paper", Vector2(vp.x - 120, 330), 44)
	card.position = Vector2(60, y)
	add_child(card)
	UI.unfold(card, 0.2)
	var grid := GridContainer.new()
	grid.columns = 2
	grid.position = Vector2(50, 44)
	grid.size = Vector2(card.size.x - 100, 260)
	grid.add_theme_constant_override("h_separation", 20)
	grid.add_theme_constant_override("v_separation", 6)
	card.add_child(grid)
	var rows := [["Waves", str(summary["wave"])], ["Enemies defeated", str(summary["kills"])], ["Merges", str(summary["merges"])], ["Best rank", str(summary["max_rank"])],
		["Time", UI.fmt_time(float(summary["time"]))], ["City HP left", str(maxi(0, int(summary["city_hp"])))]]
	for r in rows:
		var a := UI.label(r[0], 36, UI.INK_SOFT, false, HORIZONTAL_ALIGNMENT_LEFT)
		a.custom_minimum_size = Vector2(400, 44)
		var b := UI.label(r[1], 40, UI.INK, true, HORIZONTAL_ALIGNMENT_RIGHT)
		b.custom_minimum_size = Vector2(card.size.x - 540, 44)
		grid.add_child(a); grid.add_child(b)
	y += 350
	# rewards row
	var rw := UI.panel("kraft", Vector2(vp.x - 120, 200), 44)
	rw.position = Vector2(60, y)
	add_child(rw)
	UI.unfold(rw, 0.45)
	var items := [["icon_coin", "+%d" % int(rewards["coins"])], ["icon_gem", "+%d" % int(rewards["gems"])], ["icon_xp", "+%d XP" % int(rewards["xp"])]]
	for i in items.size():
		var ic := UI.icon(items[i][0], 84)
		ic.position = Vector2(60 + i * 330, 24)
		rw.add_child(ic)
		var l := UI.label(items[i][1], 50, UI.INK, true, HORIZONTAL_ALIGNMENT_LEFT)
		l.position = Vector2(150 + i * 330, 24); l.size = Vector2(200, 84)
		rw.add_child(l)
	var lvl := UI.label("LEVEL %d" % Save.player_level(), 36, UI.INK, true, HORIZONTAL_ALIGNMENT_LEFT)
	lvl.position = Vector2(50, 124); lvl.size = Vector2(260, 50)
	rw.add_child(lvl)
	_lvl_label = lvl
	var bbg := Atlas.nine("ui_bar_bg", 20)
	bbg.size = Vector2(vp.x - 120 - 340, 34); bbg.position = Vector2(290, 132)
	rw.add_child(bbg)
	_xp_bar = Atlas.nine("ui_bar_fill_blue", 20)
	_xp_bar.size = Vector2(22, 34); _xp_bar.position = bbg.position
	rw.add_child(_xp_bar)
	var xf := float(Save.data["profile"]["xp"]) / float(Save.xp_needed(Save.player_level()))
	var tw2 := create_tween()
	tw2.tween_interval(0.9)
	tw2.tween_property(_xp_bar, "size:x", maxf(22.0, bbg.size.x * xf), 0.8).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	y += 220
	# cards earned
	if not rewards["cards"].is_empty():
		var cl := UI.label("CARDS EARNED", 34, UI.WHITE, true, HORIZONTAL_ALIGNMENT_CENTER, 6)
		cl.position = Vector2(0, y); cl.size = Vector2(vp.x, 44)
		add_child(cl)
		y += 50
		var crow := HBoxContainer.new()
		crow.alignment = BoxContainer.ALIGNMENT_CENTER
		crow.position = Vector2(0, y); crow.size = Vector2(vp.x, 150)
		crow.add_theme_constant_override("separation", 10)
		add_child(crow)
		var k := 0
		for id in rewards["cards"]:
			var c := Control.new()
			c.custom_minimum_size = Vector2(104, 140)
			var uc := UI.unit_card(id, Vector2(104, 140), false)
			c.add_child(uc)
			var cnt := UI.label("+%d" % int(rewards["cards"][id]), 30, UI.WHITE, true, HORIZONTAL_ALIGNMENT_CENTER, 6)
			cnt.position = Vector2(0, 98); cnt.size = Vector2(104, 40)
			c.add_child(cnt)
			crow.add_child(c)
			UI.pop_in(c, 1.0 + 0.1 * k)
			k += 1
		y += 160
	# buttons
	var by := vp.y - 330 - Game.safe_bottom
	var bw := (vp.x - 100 - 20) * 0.5
	var home := UI.btn("HOME", "gray", Vector2(bw, 110), func(): Game.go("home", {}, true, false), 46)
	home.position = Vector2(40, by)
	add_child(home)
	var main_label := "RETRY"
	var main_cb: Callable = func(): Game.start_run(Game.build_cfg(mode, _retry_params()))
	if mode == "story" and win:
		var nx := _next_level()
		if nx != "":
			main_label = "NEXT LEVEL"
			main_cb = func():
				var p := nx.split("-")
				Game.go("map", {"focus": nx}, true, false)
		else:
			main_label = "CAMPAIGN"
			main_cb = func(): Game.go("map", {}, true, false)
	elif mode == "tutorial":
		main_label = "CONTINUE"
		main_cb = func(): Game.go("home", {}, true, false)
	var nb2 := UI.btn(main_label, "green", Vector2(bw, 110), main_cb, 46)
	nb2.position = Vector2(60 + bw, by)
	add_child(nb2)
	UI.pop_in(nb2, 1.2)
	# unlock reveal + level-up popups
	if rewards["unlock"] != "":
		var tt := create_tween()
		tt.tween_interval(1.4)
		tt.tween_callback(func(): _show_unlock(rewards["unlock"]))
	elif int(rewards.get("levelups", 0)) > 0:
		var t3 := create_tween()
		t3.tween_interval(1.4)
		t3.tween_callback(func(): _show_levelup())
	if mode == "story" and win and cfg["level"] == 6 and rewards["first_clear"]:
		var t4 := create_tween()
		t4.tween_interval(2.2)
		t4.tween_callback(func(): Game.play_dialogue("ch%d_post" % int(cfg["chapter"])))
	if mode == "tutorial":
		var t5 := create_tween()
		t5.tween_interval(1.6)
		t5.tween_callback(func(): Game.play_dialogue("tutorial_end"))
	Audio.sfx("win" if win else "lose")

func _retry_params() -> Dictionary:
	if cfg["mode"] == "story":
		return {"chapter": cfg["chapter"], "level": cfg["level"]}
	return {}

func _next_level() -> String:
	var ch: int = int(cfg["chapter"]); var lv: int = int(cfg["level"])
	if lv < 6:
		return "%d-%d" % [ch, lv + 1]
	if ch < 9:
		return "%d-1" % (ch + 1)
	return ""

func _show_unlock(id: String) -> void:
	Audio.sfx("unlock")
	var d: Dictionary = Data.units[id]
	var body := VBoxContainer.new()
	body.alignment = BoxContainer.ALIGNMENT_CENTER
	var card := UI.unit_card(id, Vector2(300, 400), false)
	var holder := Control.new()
	holder.custom_minimum_size = Vector2(300, 410)
	holder.add_child(card)
	card.position = Vector2(220, 0)
	body.add_child(holder)
	var l := UI.label("%s\n%s" % [d["ability"], d["ability_desc"]], 32, UI.INK)
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.custom_minimum_size = Vector2(740, 120)
	body.add_child(l)
	var p := Game.popup("NEW VEHICLE!", body, [{"text": "AWESOME!", "color": "green"}], Vector2(860, 860))
	UI.pop_in(card, 0.2, 0.2)
	p.closed.connect(func():
		if int(rewards.get("levelups", 0)) > 0:
			_show_levelup())

func _show_levelup() -> void:
	Audio.sfx("levelup")
	var l := UI.label("ACCOUNT LEVEL %d!\nBonus coins awarded." % Save.player_level(), 42, UI.INK, true)
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.custom_minimum_size = Vector2(700, 200)
	Game.popup("LEVEL UP!", l, [{"text": "NICE", "color": "green"}], Vector2(860, 560))
