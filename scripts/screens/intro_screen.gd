extends Screen
## Animated opening sequence: four paper story panels with Ken-Burns pans, animated vehicles and typed narration.

var panels: Array = []
var idx: int = -1
var frame: Control
var clip: Control
var pic: TextureRect
var cap: Label
var overlay: Control
var _typing: float = 0.0
var _full: bool = false
var _t: float = 0.0
var _busy: bool = false
var _tw: Tween
var _fx: Array = []
var _tap_hint: Label

func _ready() -> void:
	music = "menu"
	super._ready()
	panels = Data.story["intro_panels"]
	var vp := vsize()
	UI.paper_bg(self, Color("2c2826"))
	var title := UI.label("TRAFFIC JAM", 64, Color(1, 1, 1, 0.9), true, HORIZONTAL_ALIGNMENT_CENTER, 12)
	title.position = Vector2(0, Game.safe_top + 40); title.size = Vector2(vp.x, 80)
	add_child(title)
	# polaroid-like frame
	frame = Atlas.nine("ui_panel_paper", 44)
	frame.size = Vector2(vp.x - 100, 900)
	frame.position = Vector2(50, vp.y * 0.5 - 520)
	add_child(frame)
	clip = Control.new()
	clip.clip_contents = true
	clip.position = Vector2(34, 34)
	clip.size = Vector2(frame.size.x - 68, 560)
	frame.add_child(clip)
	pic = TextureRect.new()
	pic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	pic.stretch_mode = TextureRect.STRETCH_SCALE
	pic.size = clip.size * 1.25
	clip.add_child(pic)
	overlay = Control.new()
	overlay.size = clip.size
	overlay.mouse_filter = Control.MOUSE_FILTER_IGNORE
	clip.add_child(overlay)
	var grain := TextureRect.new()
	grain.texture = Atlas.tile("ui_halftone_tile")
	grain.stretch_mode = TextureRect.STRETCH_TILE
	grain.size = clip.size
	grain.modulate = Color(1, 1, 1, 0.5)
	grain.mouse_filter = Control.MOUSE_FILTER_IGNORE
	clip.add_child(grain)
	for tp in [[Vector2(frame.size.x * 0.5 - 90 - 220, -30), -8.0], [Vector2(frame.size.x * 0.5 - 90 + 240, -26), 9.0]]:
		var tape := TextureRect.new()
		tape.texture = Atlas.tex("ui_tape")
		tape.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		tape.size = Vector2(170, 56)
		tape.position = tp[0]
		tape.rotation = deg_to_rad(tp[1])
		frame.add_child(tape)
	cap = UI.label("", 52, UI.INK, false, HORIZONTAL_ALIGNMENT_CENTER)
	cap.position = Vector2(40, 610)
	cap.size = Vector2(frame.size.x - 80, 260)
	cap.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	cap.vertical_alignment = VERTICAL_ALIGNMENT_TOP
	frame.add_child(cap)
	_tap_hint = UI.label("tap to continue", 32, Color(1, 1, 1, 0.7), false)
	_tap_hint.position = Vector2(0, vp.y - 200 - Game.safe_bottom); _tap_hint.size = Vector2(vp.x, 50)
	add_child(_tap_hint)
	var skip := UI.btn("SKIP", "gray", Vector2(170, 74), func(): _end(), 32)
	skip.position = Vector2(vp.x - 200, Game.safe_top + 36)
	add_child(skip)
	_next()

func _gui_input(ev: InputEvent) -> void:
	if ev is InputEventMouseButton and ev.pressed and ev.button_index == MOUSE_BUTTON_LEFT:
		if _busy:
			return
		if not _full:
			cap.visible_characters = -1
			_full = true
		else:
			_next()

func _next() -> void:
	idx += 1
	if idx >= panels.size():
		_end(); return
	_busy = true
	var p: Dictionary = panels[idx]
	for f in _fx:
		if is_instance_valid(f): f.queue_free()
	_fx.clear()
	# paper "flip": frame slides out, new content, slides in
	var tw := create_tween()
	if idx > 0:
		tw.tween_property(frame, "rotation", deg_to_rad(4), 0.12)
		tw.parallel().tween_property(frame, "modulate:a", 0.0, 0.12)
	tw.tween_callback(func(): _setup_panel(p))
	tw.tween_property(frame, "rotation", 0.0, 0.35).set_trans(Tween.TRANS_ELASTIC).set_ease(Tween.EASE_OUT)
	tw.parallel().tween_property(frame, "modulate:a", 1.0, 0.15)
	tw.tween_callback(func(): _busy = false)
	Audio.sfx("whoosh", 1.0, -8)

func _setup_panel(p: Dictionary) -> void:
	var tex := Atlas.tex(p["cut"])
	pic.texture = tex
	var base: Vector2 = clip.size * 1.25
	pic.size = base
	pic.pivot_offset = base * 0.5
	if _tw: _tw.kill()
	_tw = create_tween()
	match p["pan"]:
		"right":
			pic.position = Vector2(0, -20)
			_tw.tween_property(pic, "position", Vector2(-(base.x - clip.size.x), -60), 7.0)
		"left":
			pic.position = Vector2(-(base.x - clip.size.x), -40)
			_tw.tween_property(pic, "position", Vector2(0, -80), 7.0)
		_:
			pic.position = (clip.size - base) * 0.5
			pic.scale = Vector2(1.0, 1.0)
			_tw.tween_property(pic, "scale", Vector2(1.18, 1.18), 7.0)
	cap.text = p["text"]
	cap.visible_characters = 0
	_typing = 0.0
	_full = false
	_panel_fx(idx)

func _panel_fx(i: int) -> void:
	var w := clip.size.x
	var h := clip.size.y
	match i:
		0:
			var van := Atlas.sprite("veh_delivery_van", true)
			van.scale = Vector2(-2.6, 2.6)
			van.position = Vector2(-300, h - 90)
			overlay.add_child(van); _fx.append(van)
			var tw := create_tween()
			tw.tween_property(van, "position:x", w * 0.45, 2.4).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
			tw.tween_property(van, "position:x", w + 400, 4.0).set_delay(1.5).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
		1:
			for k in 4:
				var v := Atlas.sprite("veh_" + ["taxi", "compact", "hatchback", "pickup"][k], true)
				v.scale = Vector2(-2.2, 2.2)
				v.position = Vector2(w + 200, h - 80 + k * 6)
				overlay.add_child(v); _fx.append(v)
				var tw2 := create_tween()
				tw2.tween_property(v, "position:x", w * 0.78 - k * 190, 1.2 + 0.25 * k).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
				tw2.tween_callback(func(): Audio.sfx("horn", 0.8 + 0.1 * k, -4))
			var ex := Atlas.sprite("icon_alert")
			ex.scale = Vector2(0.01, 0.01); ex.position = Vector2(w * 0.5, 120)
			overlay.add_child(ex); _fx.append(ex)
			var tw3 := create_tween()
			tw3.tween_interval(1.8)
			tw3.tween_property(ex, "scale", Vector2(2.5, 2.5), 0.3).set_trans(Tween.TRANS_BACK)
			tw3.tween_callback(func():
				Audio.sfx("boom", 1.0, -6)
				frame.position += Vector2(8, 0))
			tw3.tween_property(frame, "position:x", frame.position.x, 0.2)
		2:
			var taxi := Atlas.sprite("veh_taxi", true)
			taxi.scale = Vector2(-2.4, 2.4)
			taxi.position = Vector2(w + 250, h - 70)
			overlay.add_child(taxi); _fx.append(taxi)
			var tw4 := create_tween()
			tw4.tween_property(taxi, "position:x", w * 0.72, 1.6).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
			var doll := Doll.new()
			doll.scale = Vector2(1.2, 1.2)
			doll.position = Vector2(-120, h - 20)
			overlay.add_child(doll); _fx.append(doll)
			doll.set_state("walk")
			var tw5 := create_tween()
			tw5.tween_property(doll, "position:x", w * 0.3, 2.0)
			tw5.tween_callback(func():
				doll.set_state("point"); doll.set_mood("point"))
			var sp := Atlas.sprite("fx_sparkle")
			sp.scale = Vector2(0.01, 0.01); sp.position = Vector2(w * 0.3 + 70, h - 280)
			overlay.add_child(sp); _fx.append(sp)
			var tw6 := create_tween()
			tw6.tween_interval(2.2)
			tw6.tween_property(sp, "scale", Vector2(1.2, 1.2), 0.4).set_trans(Tween.TRANS_BACK)
			tw6.tween_callback(func(): Audio.sfx("unlock"))
		3:
			var sh := ColorRect.new()
			sh.color = Color(0, 0, 0, 0.0)
			sh.size = Vector2(w, h)
			overlay.add_child(sh); _fx.append(sh)
			var tw7 := create_tween()
			tw7.tween_property(sh, "color:a", 0.45, 1.5)
			var st := Atlas.sprite("npc_mysterious_stranger", true)
			st.scale = Vector2(3.4, 3.4)
			st.position = Vector2(w * 0.7, h + 20)
			st.modulate = Color(0.1, 0.1, 0.15, 0.0)
			overlay.add_child(st); _fx.append(st)
			var tw8 := create_tween()
			tw8.tween_interval(1.0)
			tw8.tween_property(st, "modulate:a", 0.95, 1.2)
			tw8.tween_callback(func(): Audio.sfx("growl", 1.0, -4))
			var q := UI.label("?", 220, Color("f5efe0"), true, HORIZONTAL_ALIGNMENT_CENTER, 18)
			q.position = Vector2(w * 0.12, h * 0.15); q.size = Vector2(240, 260)
			q.modulate.a = 0.0
			overlay.add_child(q); _fx.append(q)
			var tw9 := create_tween().set_loops()
			tw9.tween_property(q, "modulate:a", 0.95, 0.5).set_delay(1.4)
			tw9.tween_property(q, "modulate:a", 0.4, 0.4)

func _process(dt: float) -> void:
	_t += dt
	_tap_hint.modulate.a = 0.5 + 0.5 * sin(_t * 4.0) if _full else 0.0
	if not _full and cap.text != "":
		_typing += dt * 32.0
		cap.visible_characters = int(_typing)
		if _typing >= cap.text.length():
			_full = true

func _end() -> void:
	Save.data["flags"]["intro_seen"] = true
	Save.mark_dirty()
	if not Save.data["flags"]["created_character"]:
		Game.go("create", {"create": true}, true, false)
	else:
		Game.go("home", {}, true, false)
