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

func setup(unit: BattleSim.SimUnit, v: BattleView, anim: bool) -> void:
	u = unit
	view = v
	_ph = randf() * TAU
	_base_pos = unit.pos
	position = unit.pos
	shadow = Atlas.sprite("fx_shadow_blob")
	shadow.scale = Vector2(1.9, 0.9)
	shadow.position = Vector2(0, 38)
	shadow.modulate = Color(1, 1, 1, 0.75)
	add_child(shadow)
	glow = Atlas.sprite("fx_glow")
	glow.scale = Vector2(2.2, 2.2)
	glow.modulate = Color(1, 0.9, 0.5, 0.0)
	add_child(glow)
	body = Node2D.new()
	body.position = Vector2(0, 36)   # pivot at wheels
	add_child(body)
	sprite = Atlas.sprite(Data.unit_art(u.uid), true)
	body.add_child(sprite)
	var tw: float = sprite.texture.region.size.x
	var th: float = sprite.texture.region.size.y
	_fit = minf(v.sim.cell.x * 0.86 / tw, v.sim.cell.y * 0.62 / th)
	_fit = clampf(_fit, 0.8, 1.55)
	_apply_scale()
	_hl = Atlas.sprite("fx_ring")
	_hl.visible = false
	_hl.scale = Vector2(1.1, 0.8)
	_hl.position = Vector2(0, 20)
	add_child(_hl)
	status_row = Node2D.new()
	status_row.position = Vector2(0, -80)
	add_child(status_row)
	_build_badge()
	_update_rank(true)
	if anim:
		_drive_in()

func _apply_scale() -> void:
	var rs := 1.0 + 0.035 * (u.rank - 1)
	sprite.scale = Vector2(_fit * rs * _flip, _fit * rs)

func _build_badge() -> void:
	badge = Control.new()
	badge.size = Vector2(52, 52)
	badge.position = Vector2(view.sim.cell.x * 0.5 - 70, view.sim.cell.y * 0.5 - 70)
	badge.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var star := Atlas.rect("ui_star_gold", 62, 62)
	star.position = Vector2(-5, -5)
	badge.add_child(star)
	badge_label = UI.label(str(u.rank), 30, UI.INK, true)
	badge_label.size = Vector2(52, 52)
	badge_label.position = Vector2(0, 3)
	badge.add_child(badge_label)
	add_child(badge)

func _update_rank(force: bool = false) -> void:
	if u.rank == _last_rank and not force:
		return
	_last_rank = u.rank
	badge_label.text = str(u.rank)
	var col := Color("fff3b0")
	if u.rank >= 7: col = Color("ff9ad0")
	elif u.rank >= 5: col = Color("ffb870")
	elif u.rank >= 3: col = Color("fff08a")
	else: col = Color("e8e2d0")
	(badge.get_child(0) as TextureRect).modulate = col
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
	body.scale = Vector2(0.3, 0.3)
	var tw := create_tween()
	tw.tween_property(body, "scale", Vector2(1.28, 1.28), 0.12).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	tw.tween_property(body, "scale", Vector2(0.9, 1.1), 0.08)
	tw.tween_property(body, "scale", Vector2.ONE, 0.2).set_trans(Tween.TRANS_ELASTIC).set_ease(Tween.EASE_OUT)
	# rank stamps
	badge.scale = Vector2(2.4, 2.4)
	badge.pivot_offset = Vector2(26, 26)
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
	_recoil_v = -d * 70.0
	_squash = 0.93
	_target_flip = -1.0 if target.x > position.x else 1.0
	_tilt = clampf(d.x * 0.08, -0.1, 0.1)

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
	shadow.position = Vector2(14, 56)

func end_drag() -> void:
	_dragging = false
	z_index = 0
	create_tween().tween_property(body, "scale", Vector2.ONE, 0.12)
	shadow.position = Vector2(0, 38)

func sync(sim: BattleSim, dt: float) -> void:
	_t += dt
	_update_rank()
	var away := u.away_t > 0.0
	visible = not away or _driving
	if away:
		return
	if not _dragging:
		pass
	# idle rumble: faster when attacking / buffs
	var rumble := sin(_t * (14.0 if u.cd < 0.2 else 8.0) + _ph)
	var bob := sin(_t * 2.2 + _ph) * 1.5 + rumble * 0.8
	_recoil = _recoil.lerp(Vector2.ZERO, clampf(dt * 14.0, 0, 1))
	_recoil += _recoil_v * dt
	_recoil_v = _recoil_v.lerp(Vector2.ZERO, clampf(dt * 18.0, 0, 1))
	_squash = lerpf(_squash, 1.0, clampf(dt * 12.0, 0, 1))
	_tilt = lerpf(_tilt, 0.0, clampf(dt * 8.0, 0, 1))
	_flip = lerpf(_flip, _target_flip, clampf(dt * 14.0, 0, 1))
	var rs := 1.0 + 0.035 * (u.rank - 1)
	sprite.scale = Vector2(_fit * rs * _flip, _fit * rs * _squash)
	body.position = Vector2(_recoil.x * 0.3, 36 + bob * 0.6 + _recoil.y * 0.3)
	body.rotation = _tilt + sin(_t * 1.3 + _ph) * 0.006
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
