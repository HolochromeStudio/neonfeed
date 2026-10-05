extends Screen
## The battle: HUD, input (deploy / drag-merge / inspect), upgrade offers, pause, tutorial, mode extras (PvP / Co-op).

var cfg: Dictionary
var sim: BattleSim
var view: BattleView
var mode: String = "story"
var speed: float = 1.0
var paused: bool = false
var ended: bool = false
var _end_t: float = 0.0
var _time_acc: float = 0.0
# HUD
var hud: Control
var wave_label: Label
var wave_bar: NinePatchRect
var wave_bar_bg: NinePatchRect
var hp_label: Label
var hp_bar: NinePatchRect
var hp_bar_w: float = 300.0
var sp_label: Label
var cost_label: Label
var deploy_btn: PaperButton
var next_btn: PaperButton
var speed_btn: PaperButton
var boss_bar: Control
var boss_fill: NinePatchRect
var boss_name: Label
var syn_row: HBoxContainer
var syn_key: String = ""
var deck_row: HBoxContainer
var info_panel: Control
var offer_layer: Control
var _drag_unit: BattleSim.SimUnit
var _drag_node: UnitNode
var _press_pos: Vector2
var _dragging: bool = false
var _press_slot: int = -1
var _hover_slot: int = -1
var _last_wave: int = 0
var _pulse_t: float = 0.0
var bot: BotAI
var opp_sim: BattleSim
var opp_bot: BotAI
var mini: Control
var _opp_kills: int = 0
var tut: Dictionary = {}
var tut_arrow: Control
var tut_text: Control
var _tut_step: int = 0
var _warned_hp: bool = false
var _sfx_wave_t: float = 0.0
var _max_syn: int = 0
var _crit_start: int = 0

func init(a: Dictionary) -> void:
	args = a
	cfg = a["cfg"]

func _ready() -> void:
	music = "battle"
	super._ready()
	mode = cfg["mode"]
	UI.paper_bg(self, Color("3a3532"), false)
	var vp := vsize()
	# --- simulation
	sim = BattleSim.new()
	var c := cfg.duplicate()
	if mode == "coop":
		c["grid_origin"] = Vector2(vp.x * 0.5 - 540.0 + (1080.0 - 5 * 136.0) * 0.5, 905)
		c["cell"] = Vector2(136, 118)
	sim.setup(c)
	if mode == "coop":
		var pb := BotAI.new(1, 0.7, false)
		sim.partner_ai = pb
	sim.ended.connect(_on_sim_ended)
	view = BattleView.new()
	view.y_offset = Game.safe_top + 10
	UI.set_full_rect(view)
	add_child(view)
	view.setup(sim)
	view.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_build_hud()
	if mode == "pvp":
		_setup_pvp()
	if cfg.get("tutorial", false):
		_tutorial_begin()
	if Dev.goto_args.has("bot"):
		bot = BotAI.new(0, 0.9, true)
	if mode == "survival":
		Game.play_dialogue("survival_intro") if not Save.data["flags"]["tips"].has("survival_intro") else null
		Save.data["flags"]["tips"]["survival_intro"] = true
	_crit_start = sim.stats["crits"]
	view.banner("GET READY!" if mode != "story" else cfg.get("title", "GO!").to_upper(), "teal", 1.0)

# ================================================================= HUD
func _build_hud() -> void:
	var vp := vsize()
	hud = Control.new()
	UI.set_full_rect(hud)
	hud.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(hud)
	var top := Game.safe_top + 10
	# pause
	var pb := UI.btn("", "orange", Vector2(96, 90), func(): _pause(), 40)
	pb.position = Vector2(20, top)
	var pic := UI.icon("icon_gear", 60)
	pic.position = Vector2(18, 14)
	pb.add_child(pic)
	hud.add_child(pb)
	# wave panel
	var wp := Atlas.nine("ui_panel_dark", 36)
	wp.size = Vector2(430, 100)
	wp.position = Vector2(vp.x * 0.5 - 215, top - 4)
	hud.add_child(wp)
	wave_label = UI.label("WAVE 1", 44, UI.WHITE, true, HORIZONTAL_ALIGNMENT_CENTER, 6)
	wave_label.position = Vector2(0, 4)
	wave_label.size = Vector2(430, 56)
	wp.add_child(wave_label)
	wave_bar_bg = Atlas.nine("ui_bar_bg", 20)
	wave_bar_bg.size = Vector2(360, 22)
	wave_bar_bg.position = Vector2(35, 66)
	wp.add_child(wave_bar_bg)
	wave_bar = Atlas.nine("ui_bar_fill_teal", 20)
	wave_bar.size = Vector2(22, 22)
	wave_bar.position = Vector2(35, 66)
	wp.add_child(wave_bar)
	if sim.total_waves > 0 and sim.cfg.get("boss", "") != "":
		var sk := UI.icon("map_node_boss", 48)
		sk.position = Vector2(395 - 24, 52)
		wp.add_child(sk)
	# speed
	speed_btn = UI.btn("x1", "blue", Vector2(120, 90), func(): _toggle_speed(), 42)
	speed_btn.position = Vector2(vp.x - 140, top)
	hud.add_child(speed_btn)
	# city HP
	var hpw := Atlas.nine("ui_panel_dark", 30)
	hpw.size = Vector2(340, 70)
	hpw.position = Vector2(20, top + 104)
	hud.add_child(hpw)
	var heart := UI.icon("icon_heart", 54)
	heart.position = Vector2(8, 8)
	hpw.add_child(heart)
	var hbg := Atlas.nine("ui_bar_bg", 18)
	hbg.size = Vector2(hp_bar_w - 70, 26)
	hbg.position = Vector2(68, 22)
	hpw.add_child(hbg)
	hp_bar = Atlas.nine("ui_bar_fill_green", 18)
	hp_bar.size = Vector2(hp_bar_w - 70, 26)
	hp_bar.position = Vector2(68, 22)
	hpw.add_child(hp_bar)
	hp_label = UI.label("20", 26, UI.WHITE, true, HORIZONTAL_ALIGNMENT_CENTER, 5)
	hp_label.size = Vector2(hp_bar_w - 70, 26)
	hp_label.position = Vector2(68, 22)
	hpw.add_child(hp_label)
	# SP
	var spw := Atlas.nine("ui_panel_dark", 30)
	spw.size = Vector2(300, 70)
	spw.position = Vector2(vp.x - 320, top + 104)
	hud.add_child(spw)
	var bolt := UI.icon("icon_bolt", 54)
	bolt.position = Vector2(10, 8)
	spw.add_child(bolt)
	sp_label = UI.label("50", 42, UI.YELLOW, true, HORIZONTAL_ALIGNMENT_RIGHT, 6)
	sp_label.size = Vector2(190, 70)
	sp_label.position = Vector2(60, 0)
	spw.add_child(sp_label)
	var sp_tag := UI.label("SP", 24, UI.WHITE, true)
	sp_tag.position = Vector2(255, 20)
	sp_tag.size = Vector2(40, 30)
	spw.add_child(sp_tag)
	# next wave button
	next_btn = UI.btn("NEXT >>", "green", Vector2(210, 70), func(): sim.call_next_wave(), 32)
	next_btn.position = Vector2(vp.x * 0.5 - 105, top + 108)
	hud.add_child(next_btn)
	next_btn.visible = false
	# boss bar
	boss_bar = Control.new()
	boss_bar.position = Vector2(60, top + 186)
	boss_bar.size = Vector2(vp.x - 120, 60)
	boss_bar.visible = false
	hud.add_child(boss_bar)
	var bbg := Atlas.nine("ui_bar_bg", 20)
	bbg.size = Vector2(vp.x - 120, 40)
	bbg.position = Vector2(0, 14)
	boss_bar.add_child(bbg)
	boss_fill = Atlas.nine("ui_bar_fill_red", 20)
	boss_fill.size = Vector2(vp.x - 120, 40)
	boss_fill.position = Vector2(0, 14)
	boss_bar.add_child(boss_fill)
	boss_name = UI.label("BOSS", 34, UI.WHITE, true, HORIZONTAL_ALIGNMENT_CENTER, 7)
	boss_name.size = Vector2(vp.x - 120, 40)
	boss_name.position = Vector2(0, 14)
	boss_bar.add_child(boss_name)
	# --- bottom: synergies, deck, deploy
	var bottom_y := vp.y - 300 - Game.safe_bottom
	if mode == "coop":
		bottom_y = vp.y - 250 - Game.safe_bottom
	syn_row = HBoxContainer.new()
	syn_row.position = Vector2(20, bottom_y - 4)
	syn_row.size = Vector2(vp.x - 40, 56)
	syn_row.add_theme_constant_override("separation", 10)
	syn_row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	hud.add_child(syn_row)
	deck_row = HBoxContainer.new()
	deck_row.position = Vector2(14, bottom_y + 58)
	deck_row.add_theme_constant_override("separation", 6)
	deck_row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	hud.add_child(deck_row)
	var dsz := Vector2(104, 150) if mode != "coop" else Vector2(0, 0)
	if mode != "coop":
		for id in sim.deck:
			var card := UI.unit_card(id, dsz, false)
			var holder := Control.new()
			holder.custom_minimum_size = dsz
			holder.add_child(card)
			holder.mouse_filter = Control.MOUSE_FILTER_STOP
			holder.gui_input.connect(func(ev):
				if ev is InputEventMouseButton and ev.pressed:
					_show_unit_def(id))
			deck_row.add_child(holder)
	# deploy button
	var bw := 420.0
	deploy_btn = UI.btn("DEPLOY", "red", Vector2(bw, 150), func(): _on_deploy(), 62)
	deploy_btn.position = Vector2(vp.x - bw - 20, bottom_y + 70)
	hud.add_child(deploy_btn)
	cost_label = UI.label("10 SP", 34, UI.YELLOW, true, HORIZONTAL_ALIGNMENT_CENTER, 7)
	cost_label.size = Vector2(bw, 40)
	cost_label.position = Vector2(0, 100)
	deploy_btn.add_child(cost_label)
	deploy_btn.label.position.y -= 14
	deploy_btn._base_text_pos = deploy_btn.label.position
	# buttons: upgrades list
	var ub := UI.btn("BUILD", "lavender", Vector2(150, 64), func(): _show_build(), 30)
	ub.position = Vector2(vp.x - 190 - bw, bottom_y + 70) if false else Vector2(vp.x - 170, top + 190 + (70 if false else 0))
	ub.visible = false
	hud.add_child(ub)
	var bld := UI.btn("BUILD", "lavender", Vector2(150, 62), func(): _show_build(), 30)
	bld.position = Vector2(vp.x - 170, bottom_y - 4)
	hud.add_child(bld)
	_update_hud(0.0)

func _toggle_speed() -> void:
	speed = 2.0 if speed < 1.5 else (3.0 if speed < 2.5 else 1.0)
	if cfg.get("tutorial", false):
		speed = 1.0
	speed_btn.set_text("x%d" % int(speed))

# ================================================================= update
func _process(dt: float) -> void:
	if ended:
		_end_t += dt
		if _end_t > 2.4 and not has_meta("finished"):
			set_meta("finished", true)
			_finish()
		return
	if not paused and sim.state != "ended":
		var step := dt * speed
		if Dev.god_mode:
			sim.city_hp = sim.city_max
		if bot != null:
			bot.step(sim, step)
		sim.tick(step)
		if opp_sim:
			opp_bot.step(opp_sim, step)
			opp_sim.tick(step)
			opp_sim.events.clear()
			_pvp_check()
		_poll_events()
	_update_hud(dt)
	if cfg.get("tutorial", false):
		_tutorial_update(dt)
	_drag_update()

func _poll_events() -> void:
	# the view drains sim.events in its own _process; peek via a side channel by scanning state transitions
	if sim.state == "offer" and offer_layer == null:
		_show_offer()
	if sim.wave != _last_wave:
		_last_wave = sim.wave
		var boss: bool = sim.is_boss_wave(sim.wave)
		var elite: bool = sim.wave % 5 == 0 and not sim.tutorial
		if boss:
			var bd: Dictionary = Data.bosses[sim.boss_id_for(sim.wave)]
			view.banner("BOSS: " + bd["name"].to_upper(), "red", 2.0)
			Audio.sfx("growl")
			boss_name.text = "%s - %s" % [bd["name"], bd["title"]]
			if Data.story["scenes"].has("ch%d_boss" % sim.chapter_idx) and mode == "story" and not Save.data["flags"]["tips"].has("boss_%d" % sim.chapter_idx):
				Save.data["flags"]["tips"]["boss_%d" % sim.chapter_idx] = true
		elif elite:
			view.banner("ELITE WAVE %d" % sim.wave, "yellow", 1.2)
			Audio.sfx("horn", 0.8)
		else:
			view.banner("WAVE %d" % sim.wave, "teal", 0.9)
			Audio.sfx("gong", 1.4, -6)

func _update_hud(dt: float) -> void:
	_pulse_t += dt
	var wtxt := "WAVE %d" % sim.wave if sim.total_waves <= 0 else "WAVE %d / %d" % [maxi(sim.wave, 1), sim.total_waves]
	if sim.state == "countdown" and sim.wave == 0:
		wtxt = "GET READY"
	wave_label.text = wtxt
	var wf := sim.wave_progress() if sim.total_waves > 0 else clampf(float(sim.wave % 10) / 10.0, 0, 1)
	wave_bar.size.x = maxf(22.0, 360.0 * wf)
	hp_bar.size.x = maxf(8.0, (hp_bar_w - 70) * clampf(float(sim.city_hp) / float(sim.city_max), 0.0, 1.0))
	hp_label.text = "%d / %d" % [maxi(0, sim.city_hp), sim.city_max]
	var frac := float(sim.city_hp) / float(sim.city_max)
	if frac < 0.3 and not _warned_hp:
		_warned_hp = true
		Audio.sfx("siren", 1.0, -6)
	if frac >= 0.45:
		_warned_hp = false
	sp_label.text = str(int(sim.sp))
	var cost := sim.deploy_cost(0)
	cost_label.text = "FREE!" if cost == 0 else "%d SP" % cost
	var can := sim.can_deploy(0)
	cost_label.add_theme_color_override("font_color", UI.YELLOW if int(sim.sp) >= cost else Color("ff8a7a"))
	if can:
		deploy_btn.scale = Vector2.ONE * (1.0 + 0.012 * sin(_pulse_t * 6.0)) if not deploy_btn._down else deploy_btn.scale
	next_btn.visible = sim.state == "countdown" and sim.wave_timer > 1.0 and sim.wave >= 1 and not (sim.total_waves > 0 and sim.wave >= sim.total_waves)
	# boss bar
	var boss: BattleSim.SimEnemy = null
	for e in sim.enemies:
		if e.boss and e.alive:
			boss = e
	boss_bar.visible = boss != null
	if boss:
		boss_fill.size.x = maxf(20.0, (vsize().x - 120) * clampf(boss.hp / boss.max_hp, 0, 1))
	_update_synergies()

func _update_synergies() -> void:
	var key := ""
	for s in sim.synergy_active:
		key += s["id"] + str(s["tier"]) + ","
	if key == syn_key:
		return
	syn_key = key
	_max_syn = maxi(_max_syn, sim.synergy_active.size())
	for c in syn_row.get_children():
		c.queue_free()
	for s in sim.synergy_active:
		var chip := PanelContainer.new()
		var holder := Control.new()
		holder.custom_minimum_size = Vector2(250, 52)
		var bg := Atlas.nine("ui_panel_teal", 20)
		bg.size = Vector2(250, 52)
		holder.add_child(bg)
		var l := UI.label(s["name"], 24, UI.WHITE, true, HORIZONTAL_ALIGNMENT_CENTER, 4)
		l.size = Vector2(250, 52)
		holder.add_child(l)
		holder.mouse_filter = Control.MOUSE_FILTER_STOP
		var sd: Dictionary = s
		holder.gui_input.connect(func(ev):
			if ev is InputEventMouseButton and ev.pressed:
				Game.toast("%s: %s" % [sd["name"], sd["desc"]], "icon_star"))
		syn_row.add_child(holder)
		UI.pop_in(holder, 0.0, 0.5)

func _on_deploy() -> void:
	if sim.state == "ended" or sim.state == "offer":
		return
	var forced := ""
	if cfg.get("tutorial", false) and sim.deploy_count < 3:
		forced = "taxi"
	if not sim.can_deploy(0):
		Audio.sfx("error")
		deploy_btn.scale = Vector2(0.95, 0.95)
		var msg := "Board is full - merge vehicles!" if sim.empty_slots(0).is_empty() else "Not enough SP"
		view._text(Vector2(540, 1400), msg, Color("ff8a7a"), 40)
		UI.wobble(deploy_btn if false else view.world, 0.0)
		return
	sim.deploy(0, -1, forced)

# ================================================================= input
func _gui_input(ev: InputEvent) -> void:
	if paused or ended or sim.state == "offer":
		return
	if ev is InputEventMouseButton and ev.button_index == MOUSE_BUTTON_LEFT:
		if ev.pressed:
			var s := view.slot_at(ev.position - view.position)
			_press_pos = ev.position
			_press_slot = s
			_dragging = false
			if s >= 0 and sim.slots[s] != null and sim.slots[s].owner == 0 and sim.slots[s].away_t <= 0.0:
				_drag_unit = sim.slots[s]
				_drag_node = view.unit_node(_drag_unit.id)
			else:
				_drag_unit = null; _drag_node = null
		else:
			_release(ev.position)
	elif ev is InputEventMouseMotion and (ev.button_mask & MOUSE_BUTTON_MASK_LEFT) != 0:
		if _drag_unit and not _dragging and ev.position.distance_to(_press_pos) > 16.0:
			_begin_drag()
		if _dragging and _drag_node:
			var fp := view.to_field(ev.position - view.position) + Vector2(0, -50)
			_drag_node.position = fp
			var s := view.slot_at(ev.position - view.position)
			if s != _hover_slot:
				_hover_slot = s
				_refresh_drag_highlights()

func _begin_drag() -> void:
	_dragging = true
	if _drag_node:
		_drag_node.begin_drag()
	Audio.sfx("pop", 1.5, -8)
	_refresh_drag_highlights()
	_hide_info()

func _refresh_drag_highlights() -> void:
	view.clear_slot_states()
	if _drag_unit == null:
		return
	for i in sim.slots.size():
		var u: BattleSim.SimUnit = sim.slots[i]
		if sim.slot_owner(i) != 0 or i == _drag_unit.slot:
			continue
		if u == null:
			view.set_slot_state(i, "ok")
		elif sim.can_merge(_drag_unit, u):
			view.set_slot_state(i, "merge")
			var n := view.unit_node(u.id)
			if n: n.set_highlight(true)
		else:
			pass
	for u in sim.units:
		var n2 := view.unit_node(u.id)
		if n2 and not (u != _drag_unit and sim.can_merge(_drag_unit, u)):
			n2.set_highlight(false)

func _release(pos: Vector2) -> void:
	view.clear_slot_states()
	for u in sim.units:
		var n := view.unit_node(u.id)
		if n: n.set_highlight(false)
	if _dragging and _drag_unit and _drag_node:
		var s := view.slot_at(pos - view.position)
		var node := _drag_node
		node.end_drag()
		var ok := false
		if s >= 0 and s != _drag_unit.slot and sim.slot_owner(s) == 0:
			ok = sim.move_unit(_drag_unit, s)
		if not ok and is_instance_valid(node) and sim.units.has(_drag_unit):
			var tw := node.create_tween()
			tw.tween_property(node, "position", sim.slot_pos(_drag_unit.slot), 0.18).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	elif _drag_unit and pos.distance_to(_press_pos) < 20.0:
		_show_unit_info(_drag_unit)
	else:
		_hide_info()
	_dragging = false
	_drag_unit = null; _drag_node = null

func _drag_update() -> void:
	pass

# ================================================================= info / build / def popovers
func _hide_info() -> void:
	if info_panel and is_instance_valid(info_panel):
		info_panel.queue_free()
	info_panel = null

func _show_unit_info(u: BattleSim.SimUnit) -> void:
	_hide_info()
	var vp := vsize()
	var d: Dictionary = u.def
	var p := Atlas.nine("ui_panel_paper", 44)
	p.size = Vector2(vp.x - 60, 480)
	p.position = Vector2(30, vp.y - 800 - Game.safe_bottom)
	hud.add_child(p)
	info_panel = p
	var card := UI.unit_card(u.uid, Vector2(190, 260), false)
	card.position = Vector2(34, 36)
	p.add_child(card)
	var st := UI.stars(u.rank, 34)
	st.position = Vector2(46, 304)
	p.add_child(st)
	var title := UI.label("%s  -  Rank %d" % [d["name"], u.rank], 44, UI.INK, true, HORIZONTAL_ALIGNMENT_LEFT)
	title.position = Vector2(250, 22)
	title.size = Vector2(p.size.x - 290, 56)
	p.add_child(title)
	var dmg := sim.unit_base_dmg(u) * u.dmg_mult
	var aps := u.spd_mult / sim.unit_interval(u)
	var stats := "[b]DMG[/b] %s    [b]SPD[/b] %.2f/s    [b]RANGE[/b] %d\n[b]Role[/b] %s    [b]Tags[/b] %s\n[b]%s:[/b] %s" % [UI.fmt_num(dmg), aps, int(float(d["range"]) * u.range_mult), ", ".join(d["roles"]), ", ".join(d["tags"]), d["ability"], d["ability_desc"]]
	var r := UI.rich(stats, 29, UI.INK)
	r.position = Vector2(250, 84)
	r.size = Vector2(p.size.x - 290, 260)
	p.add_child(r)
	var fl := UI.label("\"" + d["flavor"] + "\"", 26, UI.INK_SOFT, false, HORIZONTAL_ALIGNMENT_LEFT)
	fl.position = Vector2(250, 316)
	fl.size = Vector2(p.size.x - 290, 40)
	fl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	p.add_child(fl)
	var sell := UI.btn("SELL +%d SP" % (4 * u.rank), "orange", Vector2(300, 84), func():
		sim.sell_unit(u); _hide_info(), 32)
	sell.position = Vector2(p.size.x - 640, 384)
	p.add_child(sell)
	var cl := UI.btn("CLOSE", "gray", Vector2(280, 84), func(): _hide_info(), 34)
	cl.position = Vector2(p.size.x - 320, 384)
	p.add_child(cl)
	UI.unfold(p)
	var hl := view.unit_node(u.id)
	if hl:
		hl.flash(Color(1, 1, 0.6))

func _show_unit_def(id: String) -> void:
	_hide_info()
	var vp := vsize()
	var d: Dictionary = Data.units[id]
	var p := Atlas.nine("ui_panel_paper", 44)
	p.size = Vector2(vp.x - 60, 400)
	p.position = Vector2(30, vp.y - 720 - Game.safe_bottom)
	hud.add_child(p)
	info_panel = p
	var card := UI.unit_card(id, Vector2(180, 250), true)
	card.position = Vector2(34, 30)
	p.add_child(card)
	var title := UI.label(d["name"], 44, UI.INK, true, HORIZONTAL_ALIGNMENT_LEFT)
	title.position = Vector2(240, 20); title.size = Vector2(p.size.x - 270, 56)
	p.add_child(title)
	var r := UI.rich("[b]%s:[/b] %s\n[b]Roles[/b] %s   [b]Tags[/b] %s" % [d["ability"], d["ability_desc"], ", ".join(d["roles"]), ", ".join(d["tags"])], 30, UI.INK)
	r.position = Vector2(240, 84); r.size = Vector2(p.size.x - 270, 230)
	p.add_child(r)
	var cl := UI.btn("CLOSE", "gray", Vector2(240, 76), func(): _hide_info(), 32)
	cl.position = Vector2(p.size.x - 270, 310)
	p.add_child(cl)
	UI.unfold(p)

func _show_build() -> void:
	_hide_info()
	paused = true
	var body := VBoxContainer.new()
	body.add_theme_constant_override("separation", 8)
	body.custom_minimum_size = Vector2(740, 680)
	var scroll := ScrollContainer.new()
	scroll.custom_minimum_size = Vector2(740, 640)
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	var vb := VBoxContainer.new()
	vb.add_theme_constant_override("separation", 6)
	vb.custom_minimum_size = Vector2(730, 0)
	scroll.add_child(vb)
	vb.add_child(UI.label("SYNERGIES", 38, UI.RED, true))
	if sim.synergy_active.is_empty():
		vb.add_child(UI.label("None yet - deploy matching tags!", 30, UI.INK_SOFT))
	for s in sim.synergy_active:
		var l := UI.label("%s (%d)\n%s" % [s["name"], s["count"], s["desc"]], 28, UI.INK)
		l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		l.custom_minimum_size = Vector2(720, 0)
		vb.add_child(l)
	vb.add_child(UI.label("UPGRADES", 38, UI.RED, true))
	if sim.upgrades_taken.is_empty():
		vb.add_child(UI.label("None yet.", 30, UI.INK_SOFT))
	for id in sim.upgrades_taken:
		var up: Dictionary = Data.upgrades_by_id[id]
		var l2 := UI.label("%s x%d - %s" % [up["name"], sim.upgrades_taken[id], up["desc"]], 26, UI.INK)
		l2.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		l2.custom_minimum_size = Vector2(720, 0)
		vb.add_child(l2)
	vb.add_child(UI.label("RELICS", 38, UI.RED, true))
	if sim.relics_owned.is_empty():
		vb.add_child(UI.label("None yet - elites and bosses drop relics.", 28, UI.INK_SOFT))
	for id in sim.relics_owned:
		var rl: Dictionary = Data.relics_by_id[id]
		var l3 := UI.label("%s - %s" % [rl["name"], rl["desc"]], 26, UI.INK)
		l3.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		l3.custom_minimum_size = Vector2(720, 0)
		vb.add_child(l3)
	body.add_child(scroll)
	var p := Game.popup("YOUR BUILD", body, [{"text": "CLOSE", "color": "teal"}], Vector2(860, 920))
	p.closed.connect(func(): paused = false)

# ================================================================= offers
func _show_offer() -> void:
	paused = true
	var vp := vsize()
	offer_layer = Control.new()
	UI.set_full_rect(offer_layer)
	add_child(offer_layer)
	var dim := ColorRect.new()
	dim.color = Color(0.06, 0.04, 0.04, 0.72)
	UI.set_full_rect(dim)
	offer_layer.add_child(dim)
	var relic := sim.offer_kind == "relic"
	var title := UI.label("CHOOSE A RELIC" if relic else "CHOOSE AN UPGRADE", 70, UI.WHITE, true, HORIZONTAL_ALIGNMENT_CENTER, 12)
	title.position = Vector2(0, 150 + Game.safe_top)
	title.size = Vector2(vp.x, 90)
	offer_layer.add_child(title)
	UI.pop_in(title)
	Audio.sfx("levelup" if relic else "unlock")
	var n := sim.offer.size()
	var cw := 320.0
	var gap := 24.0
	var total := n * cw + (n - 1) * gap
	var x0 := (vp.x - total) * 0.5
	for i in n:
		var o: Dictionary = sim.offer[i]
		var card := _offer_card(o, relic, Vector2(cw, 640), i)
		card.position = Vector2(x0 + i * (cw + gap), 300 + Game.safe_top)
		offer_layer.add_child(card)
		card.pivot_offset = Vector2(cw * 0.5, 320)
		card.scale = Vector2(0.01, 1.0)
		var tw := create_tween()
		tw.tween_interval(0.12 * i + 0.1)
		tw.tween_property(card, "scale", Vector2(1.08, 1.08), 0.22).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
		tw.tween_property(card, "scale", Vector2.ONE, 0.12)
		tw.tween_callback(func(): Audio.sfx("stamp", 1.0 + 0.1 * i, -8))
	var y2 := 300 + Game.safe_top + 680
	if not relic:
		var rr := UI.btn("REROLL (25 SP)", "lavender", Vector2(420, 92), func():
			if sim.reroll_offer():
				_close_offer(); _show_offer()
			else:
				Audio.sfx("error"), 34)
		rr.position = Vector2(vp.x * 0.5 - 440, y2)
		offer_layer.add_child(rr)
		var sk := UI.btn("SKIP (+20 SP)", "gray", Vector2(420, 92), func():
			sim.skip_offer_for_sp(); _close_offer(), 34)
		sk.position = Vector2(vp.x * 0.5 + 20, y2)
		offer_layer.add_child(sk)

func _offer_card(o: Dictionary, relic: bool, sz: Vector2, idx: int) -> Control:
	var root := Control.new()
	root.size = sz
	var rar: String = o["rarity"]
	var cmap := {"common": "gray", "rare": "blue", "epic": "lavender", "legendary": "orange"}
	var bg := Atlas.nine("ui_card_" + ("rare" if rar == "rare" else ("epic" if rar == "epic" else ("legendary" if rar == "legendary" else "common"))), 30)
	bg.size = sz
	root.add_child(bg)
	var col: Color = {"common": Color("969692"), "rare": Color("7496cd"), "epic": Color("aa78be"), "legendary": Color("e8965c")}.get(rar, Color.WHITE)
	var head := ColorRect.new()
	head.color = Color(col.r, col.g, col.b, 0.5)
	head.position = Vector2(20, 24); head.size = Vector2(sz.x - 40, 130)
	root.add_child(head)
	var cat: String = o.get("cat", "RELIC")
	var ic_key := "icon_star"
	if not relic:
		ic_key = {"ATTACK": "icon_bolt", "ATTACK SPEED": "icon_bolt", "CRITICAL": "icon_star", "PROJECTILE": "icon_pump", "AOE": "icon_cone", "STATUS": "icon_gear", "ECONOMY": "icon_coin", "SP": "icon_coin",
			"DEPLOY": "icon_ticket", "MERGE": "icon_crown", "POSITION": "icon_remote", "SYNERGY": "icon_rank_shield", "DEFENSE": "icon_heart", "BOSS": "icon_trophy", "RISK/REWARD": "icon_alert", "RULE CHANGERS": "icon_tire"}.get(cat, "icon_star")
	else:
		ic_key = ["icon_crown", "icon_trophy", "icon_jerrycan", "icon_pump", "icon_tire", "icon_gem", "icon_mail", "icon_calendar"][hash(o["id"]) % 8]
	var ic := UI.icon(ic_key, 110)
	ic.position = Vector2(sz.x * 0.5 - 55, 34)
	root.add_child(ic)
	var cl := UI.label(cat if not relic else "RELIC", 24, UI.INK_SOFT, true)
	cl.position = Vector2(0, 160); cl.size = Vector2(sz.x, 34)
	root.add_child(cl)
	var nm := UI.label(o["name"], 36, UI.INK, true)
	nm.position = Vector2(14, 196); nm.size = Vector2(sz.x - 28, 100)
	nm.custom_minimum_size = Vector2(sz.x - 28, 0)
	nm.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	root.add_child(nm)
	var ds := UI.label(o["desc"], 29, UI.INK, false)
	ds.position = Vector2(18, 300); ds.size = Vector2(sz.x - 36, 260)
	ds.custom_minimum_size = Vector2(sz.x - 36, 0)
	ds.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	ds.vertical_alignment = VERTICAL_ALIGNMENT_TOP
	root.add_child(ds)
	if relic and o.get("flavor", "") != "":
		var fl := UI.label(o["flavor"], 22, UI.INK_SOFT)
		fl.position = Vector2(18, 540); fl.size = Vector2(sz.x - 36, 80)
		fl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		root.add_child(fl)
	else:
		var taken: int = int(sim.upgrades_taken.get(o["id"], 0))
		if taken > 0:
			var tk := UI.label("OWNED x%d -> x%d" % [taken, taken + 1], 24, UI.RED, true)
			tk.position = Vector2(0, 580); tk.size = Vector2(sz.x, 30)
			root.add_child(tk)
	var rc := UI.rarity_chip("rare" if rar == "rare" else ("epic" if rar == "epic" else ("legendary" if rar == "legendary" else "common")), 160)
	rc.position = Vector2(sz.x * 0.5 - 80, 590)
	(rc.get_child(1) as Label).text = rar.to_upper()
	root.add_child(rc)
	root.mouse_filter = Control.MOUSE_FILTER_STOP
	root.gui_input.connect(func(ev):
		if ev is InputEventMouseButton and ev.pressed and ev.button_index == MOUSE_BUTTON_LEFT:
			sim.choose_offer(idx)
			Audio.sfx("coin")
			_close_offer())
	return root

func _close_offer() -> void:
	if offer_layer:
		offer_layer.queue_free()
		offer_layer = null
	paused = false
	if sim.state == "offer":
		_show_offer()

# ================================================================= pause / end
func _pause() -> void:
	if paused or ended:
		return
	paused = true
	var body := VBoxContainer.new()
	body.add_theme_constant_override("separation", 16)
	var mus := _slider("Music", "music")
	var sfx := _slider("Sound", "sfx")
	body.add_child(mus)
	body.add_child(sfx)
	var p := Game.popup("PAUSED", body, [
		{"text": "QUIT", "color": "red", "cb": func(): Game.confirm("QUIT RUN?", "You will lose this run's progress.", func(): Game.go("home", {}, true, false); Audio.sfx("back"))},
		{"text": "RESUME", "color": "green"}], Vector2(860, 640))
	p.closed.connect(func(): paused = false)

func _slider(label_text: String, key: String) -> Control:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 20)
	var l := UI.label(label_text, 38, UI.INK, true)
	l.custom_minimum_size = Vector2(200, 60)
	row.add_child(l)
	var s := HSlider.new()
	s.custom_minimum_size = Vector2(480, 60)
	s.min_value = 0.0; s.max_value = 1.0; s.step = 0.05
	s.value = float(Save.setting(key))
	s.value_changed.connect(func(v):
		Save.set_setting(key, v); Audio.apply_volumes(); Audio.sfx("click"))
	row.add_child(s)
	return row

func _on_sim_ended(res: String) -> void:
	ended = true
	_end_t = 0.0
	var vp := vsize()
	var win := res == "victory"
	Audio.sfx("win" if win else "lose")
	Audio.music("")
	var stamp_c := Atlas.nine("ui_ribbon_" + ("teal" if win else "red"), 22)
	stamp_c.size = Vector2(vp.x, 180)
	stamp_c.position = Vector2(0, vp.y * 0.38)
	add_child(stamp_c)
	var l := UI.label("VICTORY!" if win else "GAME OVER", 110, UI.WHITE, true, HORIZONTAL_ALIGNMENT_CENTER, 14)
	l.size = stamp_c.size
	stamp_c.add_child(l)
	UI.stamp(stamp_c)
	for u in view.unit_nodes.values():
		if win:
			var tw: Tween = u.create_tween().set_loops(3)
			tw.tween_property(u.body, "position:y", u.body.position.y - 30, 0.18).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
			tw.tween_property(u.body, "position:y", u.body.position.y, 0.18).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
	if not win:
		view.shake(10)

func _finish() -> void:
	var s := sim.summary()
	s["crits"] = sim.stats["crits"]
	s["relics"] = sim.relics_owned.size()
	s["max_synergies"] = _max_syn
	var res: String = sim.result
	if mode == "pvp" and opp_sim:
		s["result"] = "victory" if (opp_sim.city_hp <= 0 or (sim.city_hp > 0 and sim.city_hp >= opp_sim.city_hp and res == "victory")) else ("victory" if res == "victory" and opp_sim.city_hp < sim.city_hp else "defeat")
	Game.finish_run(s, cfg)

# ================================================================= PvP
func _setup_pvp() -> void:
	var oc := cfg.duplicate()
	var opp: Dictionary = cfg.get("opponent", {})
	oc["deck"] = opp.get("deck", ["police", "taxi", "fire_engine", "tow_truck", "city_bus"])
	oc["seed"] = int(cfg["seed"]) + 77
	oc["wave_seed"] = int(cfg["seed"])
	oc["player_sim"] = false
	cfg["wave_seed"] = cfg["seed"]
	sim.wave_rng.seed = int(cfg["seed"])
	opp_sim = BattleSim.new()
	opp_sim.setup(oc)
	opp_bot = BotAI.new(0, float(opp.get("skill", 0.6)), true)
	opp_sim.ended.connect(func(r): _pvp_check())
	sim.kill_hook = func(e): _pvp_kill(sim, opp_sim, e)
	opp_sim.kill_hook = func(e): _pvp_kill(opp_sim, sim, e)
	mini = PvpMini.new()
	mini.setup(opp_sim, opp)
	mini.position = Vector2(vsize().x - 330, Game.safe_top + 290)
	mini.size = Vector2(310, 230)
	hud.add_child(mini)

func _pvp_kill(from: BattleSim, to: BattleSim, e: BattleSim.SimEnemy) -> void:
	if e.sent:
		return
	var n: int = int(from.stats["kills"])
	if e.elite or e.boss:
		to.inject_enemy("suv", 2)
	elif n % 5 == 0:
		to.inject_enemy("slow_car", 1)
	if from == sim and n % 5 == 0:
		view._text(Vector2(900, 760), "SENT!", Color("ff9a8a"), 40)

func _pvp_check() -> void:
	if ended or sim.state == "ended":
		return
	if opp_sim.city_hp <= 0:
		sim._finish("victory")
	elif opp_sim.state == "ended" and opp_sim.result == "victory" and sim.state != "ended":
		pass

# ================================================================= tutorial
func _tutorial_begin() -> void:
	speed = 1.0
	sim.sp = 90.0
	_tut_step = 0
	tut_arrow = UI.icon("icon_alert", 100)
	tut_arrow.visible = false
	hud.add_child(tut_arrow)
	tut_text = null
	Game.play_dialogue("tutorial_start", func(): _tut_set(1))

func _tut_set(step: int) -> void:
	_tut_step = step
	match step:
		1: _tut_hint("Tap DEPLOY!")
		2: _tut_hint("Deploy 3 vehicles")
		3: _tut_hint("Drag one Taxi onto the other to MERGE")
		4: _tut_hint("Great! Defend the road...")
		5: _tut_hint("Pick an upgrade!")

func _tut_hint(t: String) -> void:
	if tut_text:
		tut_text.queue_free()
	var vp := vsize()
	var p := Atlas.nine("ui_panel_yellow", 36)
	p.size = Vector2(vp.x - 200, 90)
	p.position = Vector2(100, Game.safe_top + 300)
	hud.add_child(p)
	var l := UI.label(t, 40, UI.INK, true)
	l.size = p.size
	p.add_child(l)
	tut_text = p
	UI.pop_in(p)

func _tutorial_update(dt: float) -> void:
	var vp := vsize()
	var tt := _pulse_t
	match _tut_step:
		1:
			tut_arrow.visible = true
			tut_arrow.position = deploy_btn.position + Vector2(deploy_btn.size.x * 0.5 - 50, -120 + sin(tt * 8.0) * 14.0)
			if sim.deploy_count >= 1:
				_tut_set(2)
				Game.play_dialogue("tutorial_deploy")
		2:
			tut_arrow.visible = true
			tut_arrow.position = deploy_btn.position + Vector2(deploy_btn.size.x * 0.5 - 50, -120 + sin(tt * 8.0) * 14.0)
			if sim.deploy_count >= 3:
				_tut_set(3)
				Game.play_dialogue("tutorial_merge")
		3:
			var pairs := sim.mergeable_pairs(0)
			if not pairs.is_empty():
				var a: BattleSim.SimUnit = pairs[0][0]
				var b: BattleSim.SimUnit = pairs[0][1]
				var pa := view.from_field(a.pos) + view.position
				var pb := view.from_field(b.pos) + view.position
				var f := fmod(tt * 0.8, 1.0)
				tut_arrow.visible = true
				tut_arrow.position = pa.lerp(pb, f) - Vector2(50, 20)
			else:
				tut_arrow.visible = false
			if sim.stats["merges"] >= 1:
				tut_arrow.visible = false
				_tut_set(4)
		4:
			if sim.state == "offer":
				_tut_set(5)
				Game.play_dialogue("tutorial_upgrade")
		5:
			if sim.state != "offer":
				_tut_set(6)
				tut_text.queue_free(); tut_text = null
	if _tut_step >= 1 and _tut_step <= 3 and sim.state == "countdown":
		sim.wave_timer = maxf(sim.wave_timer, 2.0)
