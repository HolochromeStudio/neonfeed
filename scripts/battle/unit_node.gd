class_name UnitNode
extends Node2D
## Visual for one player vehicle: spawn (drive-in + brake), idle rumble, attack recoil, merge pop, drag, statuses.

var u: BattleSim.SimUnit
var view: BattleView
var body: Node2D            # holds sprite + attachments, animated
var sprite: Sprite2D
var shadow: Sprite2D
var glow: Sprite2D
var badge: Control
var badge_label: Label
var status_row: Node2D
var _t: float = 0.0
var _ph: float = 0.0
var _recoil: Vector2 = Vector2.ZERO
var _recoil_v: Vector2 = Vector2.ZERO
var _tilt: float = 0.0
var _squash: float = 1.0
var _flip: float = 1.0
var _target_flip: float = 1.0
var _fit: float = 1.0
var _driving: bool = false
var _base_pos: Vector2
var _status_keys: Array = []
var _dragging: bool = false
var _hl: Sprite2D
var _flash_t: float = 0.0
var _flash_col: Color = Color.WHITE
var _last_rank: int = 0
var _stun_icon: Sprite2D
var _wheel_ph: float = 0.0
var _dust_t: float = 0.0
var _hop: float = 0.0
var beacon: Sprite2D
var muzzle: Sprite2D

func setup(unit: BattleSim.SimUnit, v: BattleView, anim: bool) -> void:
	u = unit
	view = v
	_ph = randf() * TAU
	_base_pos = unit.pos
	position = unit.pos
	shadow = Sprite2D.new()
	shadow.modulate = Color(0, 0, 0, 0.32)
	shadow.position = Vector2(8, 10)
	add_child(shadow)
	glow = Atlas.sprite("fx_glow")
	glow.scale = Vector2(2.2, 2.2)
	glow.modulate = Color(1, 0.9, 0.5, 0.0)
	add_child(glow)
	body = Node2D.new()
	add_child(body)
	sprite = Atlas.sprite(Data.unit_art(u.uid))
	body.add_child(sprite)
	shadow.texture = sprite.texture
	_fit = 1.0
	_apply_scale()
	if "emergency" in u.def["tags"] or "police" in u.def["tags"]:
		beacon = Atlas.sprite("fx_glow")
		beacon.position = Vector2(0, -sprite.texture.region.size.y * 0.18)
		beacon.scale = Vector2(0.55, 0.55)
		beacon.modulate = Color(1, 0.2, 0.2, 0.0)
		body.add_child(beacon)
	muzzle = Atlas.sprite("fx_glow")
	muzzle.modulate = Color(1, 0.9, 0.5, 0.0)
	muzzle.position = Vector2(0, -sprite.texture.region.size.y * 0.5)
	muzzle.scale = Vector2(0.7, 0.7)
	body.add_child(muzzle)
	_hl = Atlas.sprite("fx_ring")
	_hl.visible = false
	_hl.scale = Vector2(1.1, 0.8)
	_hl.position = Vector2(0, 0)
	add_child(_hl)
	status_row = Node2D.new()
	status_row.position = Vector2(0, -sprite.texture.region.size.y * 0.5 - 14)
	add_child(status_row)
	_build_badge()
	_update_rank(true)
	if anim:
		_drive_in()

func _apply_scale() -> void:
	sprite.scale = Vector2.ONE

func _build_badge() -> void:
	badge = Control.new()
	badge.size = Vector2(68, 68)
	badge.position = Vector2(view.sim.cell.x * 0.5 - 76, view.sim.cell.y * 0.5 - 76)
	badge.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var star := Atlas.rect("ui_rank_1", 68, 68)
	badge.add_child(star)
	add_child(badge)

func _update_rank(force: bool = false) -> void:
	if u.rank == _last_rank and not force:
		return
	_last_rank = u.rank
	var tx := Atlas.tex("ui_rank_%d" % clampi(u.rank, 1, 7))
	(badge.get_child(0) as TextureRect).texture = tx
	glow.modulate.a = 0.0 if u.rank < 4 else 0.2 + 0.1 * (u.rank - 4)
	_apply_scale()

func _drive_in() -> void:
	_driving = true
	var target := position
	position = target + Vector2(0, 760)
	body.modulate.a = 1.0
	_tilt = -0.0
	var tw := create_tween()
	tw.tween_property(self, "position", target + Vector2(0, -14), 0.42).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	tw.tween_callback(func():
		Audio.sfx("brake", 1.0, -10)
		_squash = 0.82
		_tilt = 0.12
		view._burst(target + Vector2(0, 40), 3))
	tw.tween_property(self, "position", target, 0.18).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tw.tween_callback(func(): _driving = false)

func pop_in(rank: int) -> void:
	body.scale = Vector2(0.5, 0.5)
	var tw := create_tween()
	tw.tween_property(body, "scale", Vector2(1.25, 1.25), 0.12).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	tw.tween_property(body, "scale", Vector2(0.9, 1.1), 0.08)
	tw.tween_property(body, "scale", Vector2.ONE, 0.2).set_trans(Tween.TRANS_ELASTIC).set_ease(Tween.EASE_OUT)
	# rank stamps
	badge.scale = Vector2(2.4, 2.4)
	badge.pivot_offset = Vector2(34, 34)
	var t2 := create_tween()
	t2.tween_interval(0.12)
	t2.tween_property(badge, "scale", Vector2.ONE, 0.18).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
	t2.tween_callback(func(): Audio.sfx("stamp", 1.0 + 0.05 * rank, -10))

func move_to_slot(p: Vector2) -> void:
	_base_pos = p
	var tw := create_tween()
	tw.tween_property(self, "position", p, 0.22).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	_hop = 1.0

func recoil(target: Vector2) -> void:
	var d := (target - position).normalized()
	var an := Data.unit_anim(u.uid)
	_recoil_v = -d * float(an["recoil"])
	muzzle.position = Vector2(d.x * 38.0, d.y * 38.0 - sprite.texture.region.size.y * 0.1)
	muzzle.modulate.a = 0.9

func flash(c: Color) -> void:
	_flash_t = 0.25
	_flash_col = c

func pop_ability(name: String) -> void:
	var key := {"heal": "icon_heart", "shield": "ui_status_shield", "cleanse": "fx_sparkle", "stun_pulse": "ui_status_stun", "abduct": "ui_status_stun"}.get(name, "fx_sparkle")
	var s := Atlas.sprite(key)
	s.position = Vector2(0, -60)
	s.scale = Vector2(0.2, 0.2)
	add_child(s)
	var tw := create_tween()
	tw.set_parallel(true)
	tw.tween_property(s, "scale", Vector2(0.9, 0.9), 0.3).set_trans(Tween.TRANS_BACK)
	tw.tween_property(s, "position:y", -140.0, 0.7)
	tw.tween_property(s, "modulate:a", 0.0, 0.3).set_delay(0.5)
	tw.chain().tween_callback(s.queue_free)

func abduct() -> void:
	var tw := create_tween()
	tw.set_parallel(true)
	tw.tween_property(body, "position:y", -300.0, 0.6)
	tw.tween_property(body, "scale", Vector2(0.2, 0.2), 0.6)
	tw.tween_property(body, "modulate:a", 0.0, 0.6)

func set_highlight(on: bool, col: Color = Color(1, 0.95, 0.5)) -> void:
	_hl.visible = on
	_hl.modulate = col

func begin_drag() -> void:
	_dragging = true
	z_index = 30
	create_tween().tween_property(body, "scale", Vector2(1.18, 1.18), 0.1)

func end_drag() -> void:
	_dragging = false
	z_index = 0
	create_tween().tween_property(body, "scale", Vector2.ONE, 0.12)

func sync(sim: BattleSim, dt: float) -> void:
	_t += dt
	_update_rank()
	var away := u.away_t > 0.0
	visible = not away or _driving
	if away:
		return
	if not _dragging:
		pass
	# pixel-stepped idle: 1-frame engine rumble (4px = one art pixel), faster when attacking
	var rate := 14.0 if u.cd < 0.2 else 6.0
	var step := 1.0 if (int(_t * rate + _ph) % 2 == 0) else 0.0
	_recoil = _recoil.lerp(Vector2.ZERO, clampf(dt * 14.0, 0, 1))
	_recoil += _recoil_v * dt
	_recoil_v = _recoil_v.lerp(Vector2.ZERO, clampf(dt * 18.0, 0, 1))
	_squash = lerpf(_squash, 1.0, clampf(dt * 12.0, 0, 1))
	_tilt = lerpf(_tilt, 0.0, clampf(dt * 8.0, 0, 1))
	sprite.scale = Vector2.ONE
	body.position = Vector2(snappedf(_recoil.x * 0.3, 2.0), snappedf(step * (4.0 if rate > 10.0 else 2.0) + _recoil.y * 0.3, 2.0))
	body.rotation = 0.0
	shadow.position = Vector2(8, 10) + Vector2(-body.position.x, 0)
	if muzzle.modulate.a > 0.0:
		muzzle.modulate.a = maxf(0.0, muzzle.modulate.a - dt * 9.0)
	if beacon:
		var ph := fmod(_t * 3.0, 2.0)
		var red := ph < 1.0
		beacon.modulate = Color(1.0, 0.25, 0.2, 0.0) if false else (Color(1.0, 0.25, 0.2, 0.75 * (1.0 - fmod(ph, 1.0))) if red else Color(0.3, 0.5, 1.0, 0.75 * (1.0 - fmod(ph, 1.0))))
	# status visuals
	var keys := u.st.keys()
	if keys != _status_keys:
		_status_keys = keys.duplicate()
		_rebuild_status()
	var tint := Color.WHITE
	if u.st.has("jammed"): tint = Color(0.8, 0.7, 0.55)
	if u.st.has("silence"): tint = Color(0.7, 0.7, 0.8)
	if u.st.has("haste"): tint = Color(1.1, 1.05, 0.8)
	if _flash_t > 0.0:
		_flash_t -= dt
		tint = tint.lerp(_flash_col, clampf(_flash_t * 4.0, 0, 1))
	sprite.modulate = tint
	if u.st.has("stun"):
		if _stun_icon == null:
			_stun_icon = Atlas.sprite("ui_status_stun")
			_stun_icon.scale = Vector2(0.9, 0.9)
			add_child(_stun_icon)
		_stun_icon.position = Vector2(sin(_t * 8.0) * 24, -70 + cos(_t * 8.0) * 8)
		_stun_icon.visible = true
		body.rotation += sin(_t * 30.0) * 0.03
	elif _stun_icon:
		_stun_icon.visible = false
	if u.st.has("shield"):
		glow.modulate = Color(0.5, 0.8, 1.0, 0.35 + 0.1 * sin(_t * 6.0))
	elif glow.modulate.a > 0.0 and u.rank < 4:
		glow.modulate.a = 0.0
	elif u.rank >= 4:
		glow.modulate = Color(1, 0.9, 0.5, 0.2 + 0.1 * (u.rank - 4) + 0.05 * sin(_t * 3.0))
	if _hl.visible:
		_hl.scale = Vector2(1.1, 0.8) * (1.0 + 0.06 * sin(_t * 8.0))

func _rebuild_status() -> void:
	for c in status_row.get_children():
		c.queue_free()
	var i := 0
	for k in _status_keys:
		if not Data.statuses.has(k):
			continue
		var s := Atlas.sprite(Data.statuses[k]["icon"])
		s.scale = Vector2(0.45, 0.45)
		s.position = Vector2(i * 34 - (_status_keys.size() - 1) * 17, 0)
		status_row.add_child(s)
		i += 1
