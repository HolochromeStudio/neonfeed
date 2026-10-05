class_name EnemyNode
extends Node2D
## Visual for an enemy vehicle driving the road: direction flip, curve tilt, bob, HP bar, status icons, death.

var e: BattleSim.SimEnemy
var view: BattleView
var body: Node2D
var sprite: Sprite2D
var shadow: Sprite2D
var hp_bg: NinePatchRect
var hp_fill: NinePatchRect
var status_row: Node2D
var glow: Sprite2D
var shield_ring: Sprite2D
var _t: float = 0.0
var _ph: float = 0.0
var _fit: float = 1.0
var _flash: float = 0.0
var _flash_crit: bool = false
var _keys: Array = []
var _dust: float = 0.0
var _last_flip: float = 1.0
var _flip: float = 1.0
var _spin: float = 0.0
var _hit_squash: float = 0.0
var _sx: float = 1.0
var _stun_icon: Sprite2D
var _dead: bool = false

func setup(en: BattleSim.SimEnemy, v: BattleView) -> void:
	e = en
	view = v
	_ph = randf() * TAU
	position = en.pos
	shadow = Atlas.sprite("fx_shadow_blob")
	shadow.scale = Vector2(1.7, 0.8) * float(en.def.get("scale", 1.0))
	shadow.position = Vector2(0, 6)
	shadow.modulate = Color(1, 1, 1, 0.7)
	add_child(shadow)
	glow = Atlas.sprite("fx_glow")
	glow.modulate = Color(1, 0.85, 0.3, 0.0)
	glow.scale = Vector2(2.2, 2.2)
	glow.position = Vector2(0, -34)
	add_child(glow)
	body = Node2D.new()
	add_child(body)
	sprite = Atlas.sprite(String(en.def["art"]), true)
	body.add_child(sprite)
	var w: float = sprite.texture.region.size.x
	_fit = clampf(104.0 / w, 0.6, 1.1) * float(en.def.get("scale", 1.0))
	if en.boss:
		_fit = clampf(190.0 / w, 0.8, 1.6) * 1.0
	if en.elite:
		_fit *= 1.12
		glow.modulate = Color(1, 0.85, 0.3, 0.55)
	sprite.scale = Vector2(_fit, _fit)
	hp_bg = Atlas.nine("ui_bar_bg", 20)
	hp_bg.size = Vector2(70, 14) * (1.6 if en.boss else 1.0)
	hp_bg.position = Vector2(-hp_bg.size.x * 0.5, -sprite.texture.region.size.y * _fit - 22)
	add_child(hp_bg)
	hp_fill = Atlas.nine("ui_bar_fill_red" if not en.elite else "ui_bar_fill_yellow", 20)
	hp_fill.size = hp_bg.size
	hp_fill.position = hp_bg.position
	add_child(hp_fill)
	hp_bg.visible = en.elite or en.boss
	hp_fill.visible = hp_bg.visible
	status_row = Node2D.new()
	status_row.position = Vector2(0, -sprite.texture.region.size.y * _fit - 46)
	add_child(status_row)
	if en.shield > 0.0:
		shield_ring = Atlas.sprite("fx_ring")
		shield_ring.modulate = Color(0.6, 0.85, 1.0, 0.7)
		shield_ring.scale = Vector2(1.0, 0.8)
		shield_ring.position = Vector2(0, -30)
		add_child(shield_ring)
	# spawn pop
	body.scale = Vector2(0.3, 0.3)
	create_tween().tween_property(body, "scale", Vector2.ONE, 0.25).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	if en.boss:
		Audio.sfx("growl")
		z_index = 5

func hit_flash(crit: bool) -> void:
	_flash = 0.12
	_flash_crit = crit
	_hit_squash = 0.12 if not crit else 0.2
	if not hp_bg.visible and e.hp < e.max_hp:
		hp_bg.visible = true
		hp_fill.visible = true

func pop_status(st: String) -> void:
	pass

func sync(sim: BattleSim, dt: float) -> void:
	if _dead:
		return
	_t += dt
	position = e.pos
	var dir := e.dir
	var fear := e.st.has("fear")
	var want_flip := -1.0 if (dir.x > 0.05) != fear else 1.0
	if absf(dir.x) > 0.05:
		_flip = lerpf(_flip, want_flip, clampf(dt * 10.0, 0, 1))
	var speedf := clampf(e.speed / 90.0, 0.5, 2.5)
	var moving := not e.st.has("stun")
	var bob := sin(_t * 9.0 * speedf + _ph) * (1.6 if moving else 0.2)
	body.position.y = bob * 0.5 - (6.0 if e.flying else 0.0) + (sin(_t * 3.0) * 8.0 if e.flying else 0.0)
	var tilt := dir.y * 0.18 * (-_flip) if absf(dir.x) > 0.05 else dir.y * 0.15
	body.rotation = lerpf(body.rotation, tilt + sin(_t * 9.0 * speedf + _ph) * 0.01, clampf(dt * 8.0, 0, 1))
	_hit_squash = maxf(0.0, _hit_squash - dt)
	var sq := 1.0 - _hit_squash * 0.8
	sprite.scale = Vector2(_fit * _flip / sq, _fit * sq)
	if e.untargetable_t > 0.0:
		sprite.modulate.a = 0.35
	else:
		var col := Color.WHITE
		if e.st.has("slow"): col = Color(0.75, 0.85, 1.1)
		if e.st.has("burn"): col = Color(1.15, 0.8, 0.65)
		if e.st.has("wet"): col = col * Color(0.8, 0.9, 1.15)
		if e.st.has("shock"): col = Color(1.2, 1.2, 0.7)
		if e.st.has("oil"): col = col * Color(0.7, 0.7, 0.8)
		if e.st.has("marked"): col = col.lerp(Color(1.2, 0.6, 0.6), 0.4 + 0.2 * sin(_t * 8.0))
		if e.st.has("armor_break"): col = col * Color(1.0, 0.9, 0.8)
		if _flash > 0.0:
			_flash -= dt
			col = col.lerp(Color(2, 2, 2) if not _flash_crit else Color(2, 1.7, 0.6), clampf(_flash * 8.0, 0, 1))
		sprite.modulate = col
	# hp bar
	if hp_bg.visible:
		var f := clampf(e.hp / e.max_hp, 0.0, 1.0)
		hp_fill.size.x = maxf(14.0, hp_bg.size.x * f)
	if shield_ring:
		shield_ring.visible = e.shield > 0.0
		shield_ring.scale = Vector2(1.0 + 0.05 * sin(_t * 6.0), 0.8)
	# dust trail
	_dust -= dt
	if _dust <= 0.0 and moving and speedf > 1.3 and Save.setting("quality") != "low" and not view.preview:
		_dust = 0.28
		var d := Atlas.sprite("fx_dust")
		d.position = position + Vector2(-dir.x * 30, 4)
		d.scale = Vector2(0.4, 0.4)
		d.modulate = Color(1, 1, 1, 0.5)
		view.fx_layer.add_child(d)
		var tw := d.create_tween()
		tw.set_parallel(true)
		tw.tween_property(d, "scale", Vector2(0.9, 0.9), 0.5)
		tw.tween_property(d, "modulate:a", 0.0, 0.5)
		tw.chain().tween_callback(d.queue_free)
	var keys := e.st.keys()
	if keys != _keys:
		_keys = keys.duplicate()
		_rebuild_status()
	if e.st.has("stun"):
		if _stun_icon == null:
			_stun_icon = Atlas.sprite("ui_status_stun")
			_stun_icon.scale = Vector2(0.6, 0.6)
			add_child(_stun_icon)
		_stun_icon.position = Vector2(sin(_t * 8.0) * 20, -sprite.texture.region.size.y * _fit * 0.9)
		_stun_icon.visible = true
	elif _stun_icon:
		_stun_icon.visible = false
	if e.elite:
		glow.modulate.a = 0.45 + 0.15 * sin(_t * 4.0)

func _rebuild_status() -> void:
	for c in status_row.get_children():
		c.queue_free()
	var shown: Array = []
	for k in _keys:
		if k in ["slow", "burn", "wet", "shock", "marked", "armor_break", "oil", "fear", "stun"] and Data.statuses.has(k):
			shown.append(k)
	var i := 0
	for k in shown.slice(0, 4):
		var s := Atlas.sprite(Data.statuses[k]["icon"])
		s.scale = Vector2(0.4, 0.4)
		s.position = Vector2(i * 28 - (mini(shown.size(), 4) - 1) * 14, 0)
		status_row.add_child(s)
		i += 1

func die(boss: bool) -> void:
	_dead = true
	hp_bg.visible = false
	hp_fill.visible = false
	status_row.visible = false
	var tw := create_tween()
	tw.set_parallel(true)
	if boss:
		tw.tween_property(body, "scale", Vector2(1.4, 0.2), 0.5)
		tw.tween_property(self, "modulate:a", 0.0, 0.5).set_delay(0.2)
	else:
		tw.tween_property(body, "position:y", -50.0, 0.28).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
		tw.tween_property(body, "rotation", randf_range(-1.6, 1.6), 0.3)
		tw.tween_property(body, "scale", Vector2(0.2, 0.2), 0.3).set_delay(0.05)
		tw.tween_property(self, "modulate:a", 0.0, 0.2).set_delay(0.12)
	tw.chain().tween_callback(queue_free)
