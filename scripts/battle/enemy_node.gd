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
var _smoke_t: float = 0.0
var _art: String = ""
var _radius: float = 60.0
var _suffix: String = ""

func setup(en: BattleSim.SimEnemy, v: BattleView) -> void:
	e = en
	view = v
	_ph = randf() * TAU
	position = en.pos
	shadow = Sprite2D.new()
	shadow.modulate = Color(0, 0, 0, 0.32)
	shadow.position = Vector2(8, 10)
	add_child(shadow)
	glow = Atlas.sprite("fx_glow")
	glow.modulate = Color(1, 0.85, 0.3, 0.0)
	glow.scale = Vector2(2.2, 2.2)
	glow.position = Vector2(0, 0)
	add_child(glow)
	body = Node2D.new()
	add_child(body)
	_art = String(en.def["art"])
	sprite = Atlas.sprite(_art)
	body.add_child(sprite)
	_fit = 1.0
	if en.elite:
		glow.modulate = Color(1, 0.85, 0.3, 0.55)
	_radius = maxf(sprite.texture.region.size.x, sprite.texture.region.size.y) * 0.5
	hp_bg = Atlas.nine("ui_bar_bg", 8)
	hp_bg.size = Vector2(72, 16) * (1.6 if en.boss else 1.0)
	hp_bg.position = Vector2(-hp_bg.size.x * 0.5, -_radius - 26)
	add_child(hp_bg)
	hp_fill = Atlas.nine("ui_bar_fill_red" if not en.elite else "ui_bar_fill_yellow", 8)
	hp_fill.size = hp_bg.size
	hp_fill.position = hp_bg.position
	add_child(hp_fill)
	hp_bg.visible = en.elite or en.boss
	hp_fill.visible = hp_bg.visible
	status_row = Node2D.new()
	status_row.position = Vector2(0, -_radius - 52)
	add_child(status_row)
	if en.shield > 0.0:
		shield_ring = Atlas.sprite("fx_ring")
		shield_ring.modulate = Color(0.6, 0.85, 1.0, 0.7)
		shield_ring.scale = Vector2(1.0, 0.8)
		shield_ring.position = Vector2(0, -30)
		add_child(shield_ring)
	# spawn pop
	body.modulate.a = 0.0
	create_tween().tween_property(body, "modulate:a", 1.0, 0.18)
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
	if fear:
		dir = -dir
	var suf := _suffix
	if absf(dir.x) >= absf(dir.y) * 0.9:
		suf = "" if dir.x >= 0.0 else "_left"
	elif dir.y > 0.0:
		suf = "_down"
	else:
		suf = "_up"
	if suf != _suffix or sprite.texture == null or sprite.texture.region.size == Vector2.ZERO:
		_suffix = suf
		var key := _art + suf
		if not Atlas.has(key):
			key = _art
		sprite.texture = Atlas.tex(key)
		shadow.texture = sprite.texture
	var speedf := clampf(e.speed / 90.0, 0.5, 2.5)
	var moving := not e.st.has("stun")
	# pixel-stepped drive bounce (two frames) instead of smooth bob
	var step := 1.0 if (int(_t * 6.0 * speedf + _ph) % 2 == 0) else 0.0
	body.position.y = (step * 4.0 if moving else 0.0) - (8.0 if e.flying else 0.0) + (snappedf(sin(_t * 3.0) * 8.0, 4.0) if e.flying else 0.0)
	_hit_squash = maxf(0.0, _hit_squash - dt)
	sprite.scale = Vector2.ONE
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
		hp_fill.size.x = maxf(8.0, hp_bg.size.x * f)
	if shield_ring:
		shield_ring.visible = e.shield > 0.0
		shield_ring.scale = Vector2(1.0 + 0.05 * sin(_t * 6.0), 0.8)
	# dust trail
	_dust -= dt
	if _dust <= 0.0 and moving and speedf > 1.3 and Save.setting("quality") != "low" and not view.preview:
		_dust = 0.28
		var d := Atlas.sprite("fx_dust")
		d.position = position + Vector2(-dir.x * 30, 4)
		d.scale = Vector2(0.5, 0.5)
		d.modulate = Color(1, 1, 1, 0.5)
		view.fx_layer.add_child(d)
		var tw := d.create_tween()
		tw.set_parallel(true)
		tw.tween_property(d, "scale", Vector2(0.9, 0.9), 0.5)
		tw.tween_property(d, "modulate:a", 0.0, 0.5)
		tw.chain().tween_callback(d.queue_free)
	# damage states: smoke at <50% HP, sparks + shudder at <25%
	var hpf := e.hp / e.max_hp
	if hpf < 0.5 and not view.preview and Save.setting("quality") != "low":
		_smoke_t -= dt
		if _smoke_t <= 0.0:
			_smoke_t = 0.45 if hpf >= 0.25 else 0.25
			var sm := Atlas.sprite("fx_smoke_tiny")
			sm.position = position + Vector2(-e.dir.x * 10, -_radius * 0.5)
			sm.scale = Vector2(0.28, 0.28)
			sm.modulate = Color(0.8, 0.8, 0.8, 0.8)
			view.fx_layer.add_child(sm)
			var stw := sm.create_tween()
			stw.set_parallel(true)
			stw.tween_property(sm, "position:y", sm.position.y - 50, 0.7)
			stw.tween_property(sm, "scale", Vector2(0.6, 0.6), 0.7)
			stw.tween_property(sm, "modulate:a", 0.0, 0.7)
			stw.chain().tween_callback(sm.queue_free)
	if hpf < 0.25:
		body.position.x = 4.0 if int(_t * 20.0) % 2 == 0 else -4.0
	var keys := e.st.keys()
	if keys != _keys:
		_keys = keys.duplicate()
		_rebuild_status()
	if e.st.has("stun"):
		if _stun_icon == null:
			_stun_icon = Atlas.sprite("ui_status_stun")
			_stun_icon.scale = Vector2(0.6, 0.6)
			add_child(_stun_icon)
		_stun_icon.position = Vector2(sin(_t * 8.0) * 20, -_radius - 10.0)
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
	shadow.visible = false
	var tw := create_tween()
	tw.set_parallel(true)
	if boss:
		tw.tween_property(body, "modulate", Color(3, 3, 3, 1), 0.15)
		tw.tween_property(self, "modulate:a", 0.0, 0.45).set_delay(0.25)
	else:
		sprite.modulate = Color(3, 3, 3, 1)
		tw.tween_property(body, "position:y", -24.0, 0.2).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
		tw.tween_property(self, "modulate:a", 0.0, 0.18).set_delay(0.08)
	tw.chain().tween_callback(queue_free)
