class_name BattleView
extends Control
## Renders a BattleSim: background, road, grid, vehicles, enemies, projectiles, effects.
## The sim is authoritative; this class turns its `events` into animation and keeps node transforms in sync.

signal unit_tapped(unit_id: int)
signal slot_tapped(slot: int)
signal request_move(unit_id: int, to_slot: int)

const FIELD_W := 1080.0
var sim: BattleSim
var world: Node2D
var bg_layer: Node2D
var grid_layer: Node2D
var ent_layer: Node2D
var fx_layer: Node2D
var text_layer: Node2D
var top_fx: Node2D
var unit_nodes: Dictionary = {}
var enemy_nodes: Dictionary = {}
var slot_sprites: Array = []
var removed_pending: Array = []
var shake_t: float = 0.0
var shake_amp: float = 0.0
var preview: bool = false         # mini view (PvP opponent)
var t: float = 0.0
var dragging: UnitNode = null
var drag_slot: int = -1
var _rng := RandomNumberGenerator.new()
var hide_texts: bool = false
var boss_node: EnemyNode
var tutorial_focus: Array = []
var _scale: float = 1.0
var dim_non_focus: bool = false
var y_offset: float = 0.0

func setup(s: BattleSim, is_preview: bool = false) -> void:
	sim = s
	preview = is_preview
	_rng.randomize()
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	clip_contents = true
	world = Node2D.new()
	add_child(world)
	bg_layer = Node2D.new(); world.add_child(bg_layer)
	grid_layer = Node2D.new(); world.add_child(grid_layer)
	ent_layer = Node2D.new(); world.add_child(ent_layer)
	fx_layer = Node2D.new(); world.add_child(fx_layer)
	top_fx = Node2D.new(); world.add_child(top_fx)
	text_layer = Node2D.new(); world.add_child(text_layer)
	_build_background()
	_build_grid()
	_layout()
	resized.connect(_layout)

func _layout() -> void:
	if world == null:
		return
	var vp := size
	_scale = minf(vp.x / FIELD_W, 1.0) if not preview else vp.x / FIELD_W
	if not preview:
		_scale = vp.x / FIELD_W if vp.x < FIELD_W else 1.0
	world.scale = Vector2(_scale, _scale)
	world.position = Vector2((vp.x - FIELD_W * _scale) * 0.5, y_offset)

# ------------------------------------------------------------------ background
func _build_background() -> void:
	var look: Dictionary = RoadScene.BIOME_LOOK.get(sim.biome, RoadScene.BIOME_LOOK["city_center"])
	var night: bool = sim.biome == "night_city"
	var sky := ColorRect.new()
	sky.color = look["sky"]
	sky.position = Vector2(-600, -600); sky.size = Vector2(2300, 1200)
	bg_layer.add_child(sky)
	var pic := TextureRect.new()
	pic.texture = Atlas.tex("biome_" + sim.biome)
	pic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	pic.stretch_mode = TextureRect.STRETCH_SCALE
	pic.position = Vector2(0, -60)
	pic.size = Vector2(FIELD_W, 460)
	pic.modulate = Color(0.95, 0.95, 1.0, 0.96)
	bg_layer.add_child(pic)
	var ground := TextureRect.new()
	ground.texture = Atlas.tile(look["ground"])
	ground.stretch_mode = TextureRect.STRETCH_TILE
	ground.position = Vector2(-300, 230)
	ground.size = Vector2(FIELD_W + 600, 2000)
	ground.modulate = look["tint"]
	bg_layer.add_child(ground)
	var ground_edge := ColorRect.new()
	ground_edge.color = Color(0.1, 0.07, 0.05, 0.5)
	ground_edge.position = Vector2(-300, 226); ground_edge.size = Vector2(FIELD_W + 600, 8)
	bg_layer.add_child(ground_edge)
	# decorations between lanes first (below the road)
	_scatter_props(night)
	# road: cream border -> asphalt (textured) -> dashed centre line
	var border := Line2D.new()
	border.points = sim.path_pts
	border.width = 168.0
	border.default_color = Color("e8dcc0")
	border.joint_mode = Line2D.LINE_JOINT_ROUND
	border.begin_cap_mode = Line2D.LINE_CAP_NONE
	bg_layer.add_child(border)
	var road := Line2D.new()
	road.points = sim.path_pts
	road.width = 150.0
	road.texture = Atlas.tile("tile_asphalt_plain")
	road.texture_mode = Line2D.LINE_TEXTURE_TILE
	road.texture_repeat = CanvasItem.TEXTURE_REPEAT_ENABLED
	road.default_color = Color(0.82, 0.82, 0.9) if not night else Color(0.45, 0.45, 0.62)
	road.joint_mode = Line2D.LINE_JOINT_ROUND
	bg_layer.add_child(road)
	var dash_pts := PackedVector2Array()
	var d := 40.0
	while d < sim.path_len - 120.0:
		var a := sim.path_pos(d)
		var b := sim.path_pos(d + 34.0)
		var l := Line2D.new()
		l.points = PackedVector2Array([a, b])
		l.width = 9.0
		l.default_color = Color("f1d27a") if sim.biome != "night_city" else Color("e6c36a")
		l.antialiased = true
		bg_layer.add_child(l)
		d += 76.0
	# direction chevrons on the road
	for dd in [300.0, 900.0, 1560.0, 2100.0, 2700.0]:
		var p := sim.path_pos(dd)
		var ang := sim.path_dir(dd).angle()
		var ch := Line2D.new()
		ch.width = 8
		ch.default_color = Color(1, 1, 1, 0.55)
		ch.points = PackedVector2Array([Vector2(-14, -16), Vector2(8, 0), Vector2(-14, 16)])
		ch.position = p + Vector2(0, 40).rotated(ang)
		ch.rotation = ang
		bg_layer.add_child(ch)
	# spawn / goal markers
	var start_sign := Atlas.sprite("prop_stop_sign", true) if false else Atlas.sprite("prop_barricade_a", true)
	start_sign.position = Vector2(30, 330 - 78); start_sign.scale = Vector2(0.9, 0.9)
	bg_layer.add_child(start_sign)
	var gate := Atlas.sprite("prop_barricade_b", true)
	gate.position = Vector2(FIELD_W - 40, 790 - 78); gate.scale = Vector2(1.0, 1.0)
	bg_layer.add_child(gate)
	var goal := Atlas.sprite("prop_traffic_light", true)
	goal.position = Vector2(FIELD_W - 100, 790 + 150); goal.scale = Vector2(1.1, 1.1)
	bg_layer.add_child(goal)
	# paper table under the grid
	var tbl := Atlas.nine("ui_panel_cardboard", 44)
	var gh := sim.rows * sim.cell.y
	tbl.position = Vector2(sim.grid_origin.x - 36, sim.grid_origin.y - 36)
	tbl.size = Vector2(sim.cols * sim.cell.x + 72, gh + 72)
	grid_layer.add_child(tbl)
	if night:
		var dark := ColorRect.new()
		dark.color = Color(0.05, 0.05, 0.2, 0.28)
		dark.position = Vector2(-300, -100); dark.size = Vector2(FIELD_W + 600, 2400)
		dark.mouse_filter = Control.MOUSE_FILTER_IGNORE
		top_fx.add_child(dark)

func _scatter_props(night: bool) -> void:
	var rs := RandomNumberGenerator.new()
	rs.seed = 777 + hash(sim.biome)
	var keys := ["prop_tree", "prop_bush", "prop_street_lamp", "prop_hydrant", "prop_bench", "prop_trash_can", "prop_bush_rocks", "prop_traffic_light"]
	if sim.biome == "desert":
		keys = ["prop_rock", "prop_bush_rocks", "prop_rock", "prop_bush"]
	if sim.biome in ["industrial"]:
		keys = ["prop_barricade_a", "prop_barricade_b", "prop_junction_box", "prop_trash_can", "prop_street_lamp", "prop_rock"]
	var spots: Array = []
	# pockets between lanes (inside the U-turns) and below the last lane
	for row in [[330.0, 560.0], [560.0, 790.0]]:
		var y: float = (row[0] + row[1]) * 0.5
		var x := 150.0
		while x < FIELD_W - 130.0:
			spots.append(Vector2(x + rs.randf_range(-30, 30), y + rs.randf_range(30, 60)))
			x += rs.randf_range(200, 330)
	var x2 := 80.0
	while x2 < FIELD_W:
		spots.append(Vector2(x2, 890 + rs.randf_range(0, 20)))
		x2 += rs.randf_range(150, 260)
	for p in spots:
		var s := Atlas.sprite(keys[rs.randi() % keys.size()], true)
		s.position = p
		s.scale = Vector2.ONE * rs.randf_range(0.8, 1.0)
		if night:
			s.modulate = Color(0.55, 0.55, 0.75)
		bg_layer.add_child(s)

func _build_grid() -> void:
	slot_sprites.clear()
	for i in sim.slot_count():
		var sp := Atlas.nine("ui_slot", 36)
		sp.size = sim.cell - Vector2(10, 10)
		sp.position = sim.slot_pos(i) - sp.size * 0.5
		grid_layer.add_child(sp)
		slot_sprites.append(sp)
		if sim.coop and sim.slot_owner(i) == 1:
			sp.modulate = Color(0.75, 0.85, 1.0)

func add_coop_labels() -> void:
	var mid := sim.grid_origin.y + sim.rows * 0.5 * sim.cell.y
	for tp in [["PARTNER", sim.grid_origin.y - 30.0, Color("9ec8ff")], ["YOU", sim.grid_origin.y + sim.rows * sim.cell.y + 30.0, Color("ffe08a")]]:
		var l := UI.label(tp[0], 32, tp[2], true, HORIZONTAL_ALIGNMENT_CENTER, 7)
		l.position = Vector2(FIELD_W * 0.5 - 150, tp[1] - 20)
		l.size = Vector2(300, 40)
		grid_layer.add_child(l)

func set_slot_state(i: int, st: String) -> void:
	if i < 0 or i >= slot_sprites.size():
		return
	var sp: NinePatchRect = slot_sprites[i]
	var key := "ui_slot" if st == "" else "ui_slot_" + st
	var tx := Atlas.tex(key)
	sp.texture = tx.atlas
	sp.region_rect = tx.region

func clear_slot_states() -> void:
	for i in slot_sprites.size():
		set_slot_state(i, "")

# ------------------------------------------------------------------ main update
func _process(dt: float) -> void:
	if sim == null:
		return
	t += dt
	_process_events()
	for id in unit_nodes.keys():
		var un: UnitNode = unit_nodes[id]
		un.sync(sim, dt)
	for id in enemy_nodes.keys():
		var en: EnemyNode = enemy_nodes[id]
		en.sync(sim, dt)
	_sort_entities()
	if shake_t > 0.0:
		shake_t -= dt
		var a := shake_amp * (shake_t / 0.35)
		world.position = Vector2((size.x - FIELD_W * _scale) * 0.5, y_offset) + Vector2(_rng.randf_range(-a, a), _rng.randf_range(-a, a))
	elif world.position.y != y_offset:
		world.position = Vector2((size.x - FIELD_W * _scale) * 0.5, y_offset)

func _sort_entities() -> void:
	# painter's algorithm by y for enemies; units drawn above enemies of the same y band is fine (grid is below the road)
	var arr: Array = []
	for id in enemy_nodes:
		arr.append(enemy_nodes[id])
	arr.sort_custom(func(a, b): return a.position.y < b.position.y)
	var i := 0
	for n in arr:
		ent_layer.move_child(n, mini(i, ent_layer.get_child_count() - 1))
		i += 1

func shake(amp: float = 8.0) -> void:
	if not preview and Save.setting("screen_shake") and not Save.setting("reduce_motion"):
		shake_t = 0.35
		shake_amp = maxf(shake_amp * 0.5, amp) if shake_t > 0.2 else amp

func unit_node(id: int) -> UnitNode:
	return unit_nodes.get(id)

func slot_at(local_pos: Vector2) -> int:
	var p := (local_pos - world.position) / _scale
	var q := p - sim.grid_origin
	if q.x < 0 or q.y < 0:
		return -1
	var cx := int(q.x / sim.cell.x)
	var cy := int(q.y / sim.cell.y)
	if cx >= sim.cols or cy >= sim.rows:
		return -1
	return cy * sim.cols + cx

func to_field(local_pos: Vector2) -> Vector2:
	return (local_pos - world.position) / _scale

func from_field(fp: Vector2) -> Vector2:
	return fp * _scale + world.position

# ------------------------------------------------------------------ events
func _process_events() -> void:
	if sim.events.is_empty():
		return
	var evs := sim.events.duplicate()
	sim.events.clear()
	for e in evs:
		_handle(e)

func _handle(e: Dictionary) -> void:
	match e["t"]:
		"deploy":
			var u: BattleSim.SimUnit = sim.unit_by_id(int(e["unit"]))
			if u:
				_add_unit_node(u, true)
		"remove":
			var n: UnitNode = unit_nodes.get(int(e["unit"]))
			if n:
				unit_nodes.erase(int(e["unit"]))
				removed_pending.append(n)
				if removed_pending.size() > 2:
					var old: UnitNode = removed_pending.pop_front()
					old.queue_free()
		"sell":
			for n in removed_pending:
				n.queue_free()
			removed_pending.clear()
			_burst(e["pos"], 6)
			Audio.sfx("coin")
		"merge":
			_do_merge(e)
		"move":
			var n: UnitNode = unit_nodes.get(int(e["unit"]))
			if n:
				n.move_to_slot(sim.slot_pos(int(e["slot"])))
			var o: UnitNode = unit_nodes.get(int(e["other"]))
			if o:
				o.move_to_slot(sim.slot_pos(int(e["from"])))
			Audio.sfx("pop", 1.4, -8)
		"spawn":
			var en: BattleSim.SimEnemy = sim.enemy_by_id(int(e["enemy"]))
			if en:
				_add_enemy_node(en)
		"shoot":
			_do_shoot(e)
		"hit":
			_do_hit(e)
		"miss":
			_text(e["pos"] + Vector2(0, -50), "MISS", Color("c8c8c8"), 34)
		"kill":
			_do_kill(e)
		"leak":
			_do_leak(e)
		"block":
			_text(e["pos"], "BLOCKED", Color("8ad0ff"), 42)
			Audio.sfx("shield")
		"splash":
			_ring(e["pos"], float(e["r"]), {"wet": Color("7ab8f0"), "armor_break": Color("c8a070"), "burn": Color("f08a4a")}.get(e.get("st", ""), Color("ffe6a0")))
		"chain":
			_lightning(e["pts"])
		"pulse", "shockwave":
			_ring(e["pos"], float(e.get("r", 520)), Color("ffe6a0"))
			shake(5)
		"portal":
			_ring(e["pos"], 60, Color("c080ff"))
		"echo":
			pass
		"status":
			var en2: EnemyNode = enemy_nodes.get(int(e["enemy"]))
			if en2:
				en2.pop_status(e["st"])
		"debuff":
			var un: UnitNode = unit_nodes.get(int(e["unit"]))
			if un:
				un.flash(Color(1, 0.5, 0.5))
		"ability":
			var un2: UnitNode = unit_nodes.get(int(e["unit"]))
			if un2:
				un2.pop_ability(e["name"])
			if e["name"] == "heal":
				Audio.sfx("heal")
		"shield_pop":
			Audio.sfx("shield", 0.8)
		"cone":
			_add_cone(e)
		"hook":
			_hook_line(e["from"], e["pos"])
		"sp":
			if not hide_texts:
				_text(e["pos"], "+%d SP" % int(e["amt"]), Color("ffe08a"), 40)
		"text":
			_text(e["pos"], e["msg"], Color("ffffff"), 46)
		"heal":
			_text(Vector2(180, 80), "+%d HP" % int(e["amt"]), Color("8be08a"), 44)
		"blast":
			_ring(e["pos"], 380, Color("ffd48a")); shake(7)
		"green_wave":
			Audio.sfx("horn", 1.2); shake(4)
			_flash(Color(0.6, 1, 0.6, 0.25))
		"boss_fx":
			_boss_fx(e)
		"boss_phase":
			Audio.sfx("growl"); shake(14); _flash(Color(1, 0.3, 0.2, 0.3))
			_text(Vector2(540, 600), "PHASE %d!" % (int(e["phase"]) + 1), Color("ff9a8a"), 70)
		"returned":
			pass
		"wave_start", "wave_clear", "offer", "upgrade", "relic", "end", "cleanse_fx":
			pass

func _add_unit_node(u: BattleSim.SimUnit, anim: bool) -> UnitNode:
	var n := UnitNode.new()
	n.setup(u, self, anim)
	ent_layer.add_child(n)
	unit_nodes[u.id] = n
	if anim:
		Audio.sfx("deploy", 0.9 + randf() * 0.2, -4)
	return n

func _add_enemy_node(e: BattleSim.SimEnemy) -> EnemyNode:
	var n := EnemyNode.new()
	n.setup(e, self)
	ent_layer.add_child(n)
	enemy_nodes[e.id] = n
	if e.boss:
		boss_node = n
	return n

func sync_all() -> void:
	# create nodes for anything that already exists (used after setup / for previews)
	for u in sim.units:
		if not unit_nodes.has(u.id):
			_add_unit_node(u, false)
	for e in sim.enemies:
		if not enemy_nodes.has(e.id):
			_add_enemy_node(e)

# ------------------------------------------------------------------ merge animation
func _do_merge(e: Dictionary) -> void:
	var u: BattleSim.SimUnit = sim.unit_by_id(int(e["unit"]))
	if u == null:
		return
	var slot_p := sim.slot_pos(int(e["slot"]))
	var from_p := sim.slot_pos(int(e["from_slot"]))
	var nn := _add_unit_node(u, false)
	nn.visible = false
	var olds: Array = removed_pending.duplicate()
	removed_pending.clear()
	var tw := create_tween()
	for i in olds.size():
		var o: UnitNode = olds[i]
		var target := slot_p
		o.z_index = 20
		var ot := create_tween()
		ot.tween_property(o, "position", target + Vector2(-30 if i == 0 else 30, 0) * 0.0, 0.14).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_IN)
		ot.tween_property(o, "scale", Vector2(1.25, 0.7), 0.08)
		ot.tween_property(o, "scale", Vector2(0.4, 1.3), 0.08)
		ot.tween_callback(o.queue_free)
	Audio.sfx("whoosh", 1.2, -8)
	tw.tween_interval(0.30)
	tw.tween_callback(func():
		nn.visible = true
		nn.pop_in(int(e["rank"]))
		_burst(slot_p, 14)
		_ring(slot_p, 130, Color("fff0b0"))
		var sparkle := Atlas.sprite("fx_sparkle")
		sparkle.position = slot_p + Vector2(0, -60)
		sparkle.scale = Vector2(0.2, 0.2)
		fx_layer.add_child(sparkle)
		var st := create_tween()
		st.set_parallel(true)
		st.tween_property(sparkle, "scale", Vector2(1.4, 1.4), 0.3).set_trans(Tween.TRANS_BACK)
		st.tween_property(sparkle, "rotation", 1.0, 0.4)
		st.tween_property(sparkle, "modulate:a", 0.0, 0.4)
		st.chain().tween_callback(sparkle.queue_free)
		Audio.sfx("merge_big" if int(e["rank"]) >= 4 else "merge", 1.0 + 0.04 * int(e["rank"]))
		Audio.haptic(25)
		if e.get("lucky", false):
			_text(slot_p + Vector2(0, -130), "LUCKY!", Color("ffe08a"), 54)
		if e.get("failed", false):
			_text(slot_p + Vector2(0, -130), "FAIL", Color("ff8a7a"), 54)
		if int(e["rank"]) >= 5:
			shake(6))

# ------------------------------------------------------------------ combat fx
func _do_shoot(e: Dictionary) -> void:
	var from: Vector2 = e["pos"]
	var kind: String = e["kind"]
	var un: UnitNode = unit_nodes.get(int(e["unit"]))
	if un:
		un.recoil(e["targets"][0] if e["targets"].size() > 0 else from)
		var ad := Audio.unit_audio(un.u.uid)
		if not preview:
			Audio.sfx(ad["shoot"], ad["pitch"], -10)
	elif not preview:
		Audio.sfx("shot", 1.2, -12)
	var muzzle := from + Vector2(0, -36)
	for tp in e["targets"]:
		_projectile(muzzle, tp, kind)

func _projectile(from: Vector2, to: Vector2, kind: String) -> void:
	match kind:
		"bolt", "beam":
			var l := Line2D.new()
			l.width = 7.0 if kind == "bolt" else 12.0
			l.default_color = Color("fff3a0") if kind == "bolt" else Color("c0f0ff")
			var pts := PackedVector2Array()
			var n := 7
			for i in n + 1:
				var f := float(i) / n
				var p := from.lerp(to, f)
				if i != 0 and i != n:
					p += Vector2(_rng.randf_range(-14, 14), _rng.randf_range(-14, 14))
				pts.append(p)
			l.points = pts
			fx_layer.add_child(l)
			var tw := create_tween()
			tw.tween_property(l, "modulate:a", 0.0, 0.14)
			tw.tween_callback(l.queue_free)
		"lob":
			var s := Atlas.sprite("fx_rock_c")
			s.scale = Vector2(0.7, 0.7)
			s.position = from
			fx_layer.add_child(s)
			var dur := clampf(from.distance_to(to) / 1000.0, 0.15, 0.7)
			var tw2 := create_tween()
			tw2.set_parallel(true)
			tw2.tween_method(func(f: float):
				s.position = from.lerp(to, f) + Vector2(0, -sin(f * PI) * 120.0)
				s.rotation = f * 8.0, 0.0, 1.0, dur)
			tw2.chain().tween_callback(s.queue_free)
		"wave":
			var w := Atlas.sprite("fx_ring")
			w.position = from; w.scale = Vector2(0.15, 0.1)
			w.modulate = Color(1, 1, 1, 0.8)
			fx_layer.add_child(w)
			var tw3 := create_tween()
			tw3.set_parallel(true)
			tw3.tween_property(w, "position", to, 0.28)
			tw3.tween_property(w, "scale", Vector2(0.7, 0.5), 0.28)
			tw3.tween_property(w, "modulate:a", 0.0, 0.28)
			tw3.chain().tween_callback(w.queue_free)
		_:
			var b := Atlas.sprite("fx_bullet")
			b.position = from
			b.rotation = (to - from).angle()
			b.scale = Vector2(1.1, 1.1)
			fx_layer.add_child(b)
			var dur2 := clampf(from.distance_to(to) / 1500.0, 0.05, 0.6)
			var tw4 := create_tween()
			tw4.tween_property(b, "position", to, dur2)
			tw4.tween_callback(b.queue_free)

func _do_hit(e: Dictionary) -> void:
	var en: EnemyNode = enemy_nodes.get(int(e["enemy"]))
	if en:
		en.hit_flash(bool(e["crit"]))
	if hide_texts or preview:
		return
	if not Save.setting("show_dmg") and not e["crit"]:
		return
	var d := float(e["dmg"])
	if e["crit"]:
		_text(e["pos"] + Vector2(_rng.randf_range(-20, 20), -60), UI.fmt_num(d) + "!", Color("ffd24a"), 52)
		Audio.sfx("crit", 1.0, -10)
	elif d >= 1.0 and _rng.randf() < 0.55:
		_text(e["pos"] + Vector2(_rng.randf_range(-24, 24), -50), UI.fmt_num(d), Color("fbf6ea"), 30)

func _do_kill(e: Dictionary) -> void:
	var en: EnemyNode = enemy_nodes.get(int(e["enemy"]))
	if en:
		enemy_nodes.erase(int(e["enemy"]))
		en.die(bool(e["boss"]))
		if boss_node == en:
			boss_node = null
	_burst(e["pos"], 7 if not e["boss"] else 30)
	if not preview:
		Audio.sfx("kill", 0.9 + _rng.randf() * 0.3, -8)
	if e["boss"]:
		_explosion(e["pos"], 2.2)
		Audio.sfx("boom")
		shake(18)
		_text(e["pos"] + Vector2(0, -80), "BOSS DOWN!", Color("ffe08a"), 70)
	elif e["elite"]:
		_explosion(e["pos"], 1.0)
		shake(6)
	if not hide_texts and not preview and float(e["sp"]) > 0.0 and (e["boss"] or e["elite"] or _rng.randf() < 0.5):
		_text(e["pos"] + Vector2(0, -20), "+%d" % int(e["sp"]), Color("ffe08a"), 32)

func _do_leak(e: Dictionary) -> void:
	var en: EnemyNode = enemy_nodes.get(int(e["enemy"]))
	if en:
		enemy_nodes.erase(int(e["enemy"]))
		en.queue_free()
		if boss_node == en:
			boss_node = null
	if not preview:
		shake(14)
		Audio.sfx("horn", 0.6)
		Audio.haptic(60)
	_flash(Color(1, 0.2, 0.15, 0.3))
	_text(Vector2(e["pos"].x - 60, 740), "-%d" % int(e["dmg"]), Color("ff6a5a"), 72)

func _boss_fx(e: Dictionary) -> void:
	var k: String = e["k"]
	match k:
		"stomp", "bomb", "shell":
			var from: Vector2 = e["from"]
			var pos: Vector2 = e["pos"]
			_projectile(from, pos, "lob")
			var tw := create_tween()
			tw.tween_interval(0.35)
			tw.tween_callback(func():
				_explosion(pos, 0.7)
				shake(8)
				Audio.sfx("boom", 1.4, -6))
		"burrow":
			_burst(e["pos"], 16)
			Audio.sfx("growl", 1.4, -4)
			shake(8)
		"abduct":
			var un: UnitNode = unit_nodes.get(int(e["unit"]))
			var beam := Line2D.new()
			beam.width = 40
			beam.default_color = Color(0.6, 1, 0.7, 0.5)
			beam.points = PackedVector2Array([e["from"], e["pos"]])
			fx_layer.add_child(beam)
			var tw2 := create_tween()
			tw2.tween_property(beam, "modulate:a", 0.0, 0.7)
			tw2.tween_callback(beam.queue_free)
			Audio.sfx("beam", 0.6)
			if un:
				un.abduct()

func _add_cone(e: Dictionary) -> void:
	var c := Atlas.sprite("prop_barricade_b" if false else "icon_cone", true)
	c.position = e["pos"]
	c.scale = Vector2(0.01, 0.01)
	fx_layer.add_child(c)
	var tw := create_tween()
	tw.tween_property(c, "scale", Vector2(1.1, 1.1), 0.2).set_trans(Tween.TRANS_BACK)
	tw.tween_interval(float(e["dur"]) - 0.5)
	tw.tween_property(c, "modulate:a", 0.0, 0.3)
	tw.tween_callback(c.queue_free)

func _hook_line(from: Vector2, to: Vector2) -> void:
	var l := Line2D.new()
	l.width = 6
	l.default_color = Color("3a2e2a")
	l.points = PackedVector2Array([from + Vector2(0, -30), to])
	fx_layer.add_child(l)
	var tw := create_tween()
	tw.tween_property(l, "modulate:a", 0.0, 0.3)
	tw.tween_callback(l.queue_free)

func _lightning(pts: Array) -> void:
	var l := Line2D.new()
	l.width = 8
	l.default_color = Color("fff3a0")
	var out := PackedVector2Array()
	for i in pts.size():
		out.append(pts[i])
		if i < pts.size() - 1:
			var mid: Vector2 = (pts[i] + pts[i + 1]) * 0.5 + Vector2(_rng.randf_range(-16, 16), _rng.randf_range(-16, 16))
			out.append(mid)
	l.points = out
	fx_layer.add_child(l)
	var tw := create_tween()
	tw.tween_property(l, "modulate:a", 0.0, 0.2)
	tw.tween_callback(l.queue_free)
	if not preview:
		Audio.sfx("zap", 1.0, -10)

func _ring(pos: Vector2, r: float, col: Color) -> void:
	var s := Atlas.sprite("fx_ring")
	s.position = pos
	s.modulate = Color(col.r, col.g, col.b, 0.9)
	s.scale = Vector2(0.1, 0.1)
	fx_layer.add_child(s)
	var tw := create_tween()
	tw.set_parallel(true)
	var target := r / 90.0
	tw.tween_property(s, "scale", Vector2(target, target * 0.75), 0.3).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	tw.tween_property(s, "modulate:a", 0.0, 0.3)
	tw.chain().tween_callback(s.queue_free)

func _burst(pos: Vector2, n: int) -> void:
	if Save.setting("quality") == "low":
		n = maxi(2, n / 3)
	for i in n:
		var s := Atlas.sprite("fx_scrap_%02d" % (_rng.randi() % 14))
		s.position = pos
		s.rotation = _rng.randf() * TAU
		s.scale = Vector2.ONE * _rng.randf_range(0.6, 1.2)
		fx_layer.add_child(s)
		var a := _rng.randf() * TAU
		var dist := _rng.randf_range(40, 130)
		var tw := create_tween()
		tw.set_parallel(true)
		tw.tween_property(s, "position", pos + Vector2(cos(a), sin(a) - 0.3) * dist, 0.45).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
		tw.tween_property(s, "rotation", s.rotation + _rng.randf_range(-6, 6), 0.45)
		tw.tween_property(s, "modulate:a", 0.0, 0.45).set_delay(0.15)
		tw.chain().tween_callback(s.queue_free)

func _explosion(pos: Vector2, k: float) -> void:
	var b := Atlas.sprite("fx_boom_burst" if k > 1.5 else "fx_explosion_orange")
	b.position = pos
	b.scale = Vector2(0.2, 0.2) * k
	top_fx.add_child(b)
	var tw := create_tween()
	tw.set_parallel(true)
	tw.tween_property(b, "scale", Vector2(1.3, 1.3) * k, 0.25).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tw.tween_property(b, "rotation", _rng.randf_range(-0.3, 0.3), 0.25)
	tw.tween_property(b, "modulate:a", 0.0, 0.3).set_delay(0.25)
	tw.chain().tween_callback(b.queue_free)
	for i in int(3 * k):
		var sm := Atlas.sprite(["fx_smoke_big", "fx_smoke_med", "fx_smoke_small", "fx_smoke_cloud_b"][_rng.randi() % 4])
		sm.position = pos + Vector2(_rng.randf_range(-40, 40), _rng.randf_range(-30, 30)) * k
		sm.scale = Vector2(0.3, 0.3) * k
		sm.modulate = Color(1, 1, 1, 0.9)
		top_fx.add_child(sm)
		var t2 := create_tween()
		t2.set_parallel(true)
		t2.tween_property(sm, "scale", Vector2(0.8, 0.8) * k, 0.6).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
		t2.tween_property(sm, "position:y", sm.position.y - 60, 0.7)
		t2.tween_property(sm, "modulate:a", 0.0, 0.5).set_delay(0.25)
		t2.chain().tween_callback(sm.queue_free)

func _flash(col: Color) -> void:
	if preview or Save.setting("reduce_motion"):
		return
	var f := ColorRect.new()
	f.color = col
	f.size = size
	f.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(f)
	var tw := create_tween()
	tw.tween_property(f, "modulate:a", 0.0, 0.35)
	tw.tween_callback(f.queue_free)

func _text(pos: Vector2, txt: String, col: Color, fsize: int = 36) -> void:
	if preview:
		return
	var l := UI.label(txt, fsize, col, true, HORIZONTAL_ALIGNMENT_CENTER, 8, Color(0.12, 0.08, 0.07, 0.95))
	l.position = pos - Vector2(100, 24)
	l.size = Vector2(200, 50)
	l.pivot_offset = Vector2(100, 25)
	l.scale = Vector2(0.4, 0.4)
	text_layer.add_child(l)
	var tw := create_tween()
	tw.set_parallel(true)
	tw.tween_property(l, "scale", Vector2(1.15, 1.15), 0.14).set_trans(Tween.TRANS_BACK)
	tw.tween_property(l, "position:y", l.position.y - 70, 0.8).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	tw.tween_property(l, "modulate:a", 0.0, 0.3).set_delay(0.55)
	tw.chain().tween_callback(l.queue_free)

func banner(text: String, color: String = "red", dur: float = 1.6) -> void:
	var vpw := size.x
	var rb := Atlas.nine("ui_ribbon_" + color, 22)
	rb.size = Vector2(vpw, 130)
	rb.position = Vector2(-vpw, 500)
	add_child(rb)
	var l := UI.label(text, 84, UI.WHITE, true, HORIZONTAL_ALIGNMENT_CENTER, 12)
	l.size = rb.size
	rb.add_child(l)
	var tw := create_tween()
	tw.tween_property(rb, "position:x", 0.0, 0.32).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tw.tween_interval(dur)
	tw.tween_property(rb, "position:x", vpw, 0.28).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_IN)
	tw.tween_callback(rb.queue_free)
