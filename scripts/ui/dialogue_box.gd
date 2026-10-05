class_name DialogueBox
extends Control
## Visual-novel style dialogue. Speakers: NPC sprites (idle/mood animated) or the customised player Doll.

var scene_id: String = ""
var lines: Array = []
var idx: int = -1
var on_done: Callable
var _box: NinePatchRect
var _name: Label
var _text: RichTextLabel
var _shown: float = 0.0
var _full: bool = false
var _stage_l: Node2D
var _stage_r: Node2D
var _cur_sprite: Sprite2D
var _cur_doll: Doll
var _cur_speaker: String = ""
var _mood: String = "neutral"
var _t: float = 0.0
var _talk_pulse: float = 0.0
var _fx_t: float = 0.0
var _emote: Sprite2D
var _next_icon: Control
var _vp: Vector2
var _slot_r_sprite: Sprite2D
var _slot_l_doll: Doll
var _last_char: int = 0

func start(id: String, cb: Callable = Callable()) -> void:
	scene_id = id
	on_done = cb
	lines = Data.story["scenes"].get(id, [])

func _ready() -> void:
	UI.set_full_rect(self)
	mouse_filter = Control.MOUSE_FILTER_STOP
	_vp = get_viewport_rect().size
	if lines.is_empty():
		_finish(); return
	var dim := ColorRect.new()
	dim.color = Color(0.07, 0.05, 0.05, 0.55)
	UI.set_full_rect(dim)
	add_child(dim)
	_stage_l = Node2D.new(); add_child(_stage_l)
	_stage_r = Node2D.new(); add_child(_stage_r)
	var bh := 420.0
	_box = Atlas.nine("ui_dialog_box", 46)
	_box.size = Vector2(_vp.x - 60, bh)
	_box.position = Vector2(30, _vp.y - bh - 30 - Game.safe_bottom)
	add_child(_box)
	var nt := Atlas.nine("ui_namebox", 26)
	nt.size = Vector2(430, 86)
	nt.position = Vector2(50, -56)
	_box.add_child(nt)
	_name = UI.label("", 40, UI.INK, true)
	_name.size = nt.size
	nt.add_child(_name)
	_text = UI.rich("", 42, UI.INK)
	_text.position = Vector2(50, 50)
	_text.size = Vector2(_box.size.x - 100, bh - 90)
	_text.fit_content = false
	_text.visible_characters = 0
	_box.add_child(_text)
	_next_icon = UI.icon("icon_star", 44)
	_next_icon.position = Vector2(_box.size.x - 100, bh - 80)
	_box.add_child(_next_icon)
	var skip := UI.btn("SKIP", "gray", Vector2(170, 74), func(): _finish(), 34)
	skip.position = Vector2(_vp.x - 200, 30 + Game.safe_top)
	add_child(skip)
	_emote = Sprite2D.new(); _emote.visible = false
	add_child(_emote)
	_next_line()

func _gui_input(ev: InputEvent) -> void:
	if (ev is InputEventMouseButton and ev.pressed and ev.button_index == MOUSE_BUTTON_LEFT) or (ev is InputEventKey and ev.pressed and ev.keycode in [KEY_SPACE, KEY_ENTER]):
		accept_event()
		if not _full:
			_text.visible_characters = -1
			_full = true
			_after_text()
		else:
			_next_line()

func _next_line() -> void:
	idx += 1
	if idx >= lines.size():
		_finish(); return
	var ln: Array = lines[idx]
	_set_speaker(ln[0], ln[1])
	_text.text = ln[2]
	_text.visible_characters = 0
	_shown = 0.0
	_full = false
	_last_char = 0
	_next_icon.visible = false
	var cast: Dictionary = Data.story["cast"].get(ln[0], {"name": ""})
	_name.text = Save.data["profile"]["name"] if ln[0] == "player" else cast["name"]
	_name.get_parent().visible = _name.text != ""

func _set_speaker(who: String, mood: String) -> void:
	_mood = mood
	_fx_t = 0.0
	if who == "narrator":
		return
	var left := who == "player"
	if who != _cur_speaker:
		_cur_speaker = who
		var holder := _stage_l if left else _stage_r
		if left:
			if _slot_l_doll == null:
				_slot_l_doll = Doll.new()
				_slot_l_doll.scale = Vector2(2.1, 2.1)
				_slot_l_doll.position = Vector2(300, _box.position.y + 20)
				_stage_l.add_child(_slot_l_doll)
				_slot_l_doll.modulate.a = 0.0
		else:
			if _slot_r_sprite:
				_slot_r_sprite.queue_free()
			var art: String = Data.story["cast"][who]["art"]
			_slot_r_sprite = Sprite2D.new()
			_slot_r_sprite.texture = Atlas.tex(art)
			var h: float = _slot_r_sprite.texture.region.size.y
			var sc := minf(2.6, 560.0 / h)
			_slot_r_sprite.scale = Vector2(sc, sc)
			_slot_r_sprite.offset = Vector2(0, -h * 0.5)
			_slot_r_sprite.position = Vector2(_vp.x - 330, _box.position.y + 40)
			_stage_r.add_child(_slot_r_sprite)
			_slot_r_sprite.modulate.a = 0.0
			var tw := create_tween()
			tw.tween_property(_slot_r_sprite, "modulate:a", 1.0, 0.2)
			_slot_r_sprite.position.x += 120
			tw.parallel().tween_property(_slot_r_sprite, "position:x", _vp.x - 330, 0.35).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	# highlight active, dim other
	if _slot_l_doll:
		_slot_l_doll.modulate = Color.WHITE if left else Color(0.55, 0.55, 0.6, 1)
		create_tween().tween_property(_slot_l_doll, "modulate:a", 1.0, 0.2)
	if _slot_r_sprite:
		_slot_r_sprite.modulate = Color(0.55, 0.55, 0.6, 1) if left else Color.WHITE
	if left and _slot_l_doll:
		_slot_l_doll.set_mood(mood)
		_slot_l_doll.set_state({"happy": "happy", "angry": "angry", "worried": "worried", "surprised": "surprised", "think": "think", "point": "point"}.get(mood, "idle"))
	elif _slot_l_doll:
		_slot_l_doll.set_state("idle"); _slot_l_doll.talking = false
	_cur_sprite = _slot_r_sprite if not left else null
	_cur_doll = _slot_l_doll if left else null
	_set_emote(left)
	Audio.sfx("tick", 1.4 if left else 0.9)

func _set_emote(left: bool) -> void:
	_emote.visible = true
	var base := Vector2(300, _box.position.y - 560) if left else Vector2(_vp.x - 330, _box.position.y - 560)
	_emote.position = base
	_emote.scale = Vector2(0.01, 0.01)
	match _mood:
		"surprised": _emote.texture = Atlas.tex("icon_alert")
		"angry": _emote.texture = Atlas.tex("fx_flame")
		"worried": _emote.texture = Atlas.tex("fx_drop")
		"happy": _emote.texture = Atlas.tex("fx_sparkle")
		"think": _emote.texture = Atlas.tex("icon_gear")
		"point": _emote.texture = Atlas.tex("icon_alert")
		_:
			_emote.visible = false
			return
	var tw := create_tween()
	tw.tween_property(_emote, "scale", Vector2(1.1, 1.1), 0.25).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)

func _after_text() -> void:
	_next_icon.visible = true
	if _cur_doll:
		_cur_doll.talking = false
		_cur_doll.set_mood(_mood)

func _process(dt: float) -> void:
	_t += dt
	_fx_t += dt
	if not _full:
		_shown += dt * 52.0
		var n := int(_shown)
		if n != _last_char:
			_last_char = n
			_talk_pulse = 1.0
			if n % 3 == 0:
				Audio.sfx("tick", 1.0 + (hash(_cur_speaker) % 10) * 0.05, -14)
		_text.visible_characters = n
		if n >= _text.get_total_character_count():
			_full = true
			_after_text()
	_talk_pulse = maxf(0.0, _talk_pulse - dt * 7.0)
	if _next_icon.visible:
		_next_icon.rotation = sin(_t * 5.0) * 0.2
		_next_icon.scale = Vector2.ONE * (1.0 + sin(_t * 6.0) * 0.08)
	if _cur_doll:
		_cur_doll.talking = not _full
	# NPC procedural animation: idle breathing + mood + talk pulse
	if _slot_r_sprite:
		var active := _cur_sprite == _slot_r_sprite
		var base_s := minf(2.6, 560.0 / _slot_r_sprite.texture.region.size.y)
		var br := sin(_t * 2.2) * 0.012
		var sq := 1.0 + br + (_talk_pulse * 0.025 if active and not _full else 0.0)
		var rot := sin(_t * 1.3) * 0.015
		var yoff := 0.0
		if active:
			match _mood:
				"happy":
					yoff = -absf(sin(_t * 7.0)) * 22.0; rot = sin(_t * 7.0) * 0.05
				"angry":
					rot = sin(_t * 28.0) * 0.025; sq += 0.02
					_slot_r_sprite.modulate = Color(1.0, 0.8 + 0.1 * sin(_t * 10.0), 0.8 + 0.1 * sin(_t * 10.0))
				"worried":
					rot = sin(_t * 9.0) * 0.03; yoff = 2.0
				"surprised":
					yoff = -sin(minf(_fx_t / 0.3, 1.0) * PI) * 40.0
					sq += -0.08 * sin(minf(_fx_t / 0.3, 1.0) * PI)
				"think":
					rot = 0.06 + sin(_t * 1.5) * 0.02
				"point":
					rot = -0.05 + sin(_t * 5.0) * 0.01
			if _mood != "angry":
				_slot_r_sprite.modulate = Color.WHITE
		_slot_r_sprite.scale = Vector2(base_s / sq, base_s * sq)
		_slot_r_sprite.rotation = rot
		_slot_r_sprite.position.y = _box.position.y + 40 + yoff
	if _emote.visible:
		_emote.position.y += sin(_t * 4.0) * 0.4
		_emote.rotation = sin(_t * 3.0) * 0.1

func _finish() -> void:
	if on_done.is_valid():
		on_done.call()
	queue_free()
