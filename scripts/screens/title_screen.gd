extends Screen
## Title: logo drops in, traffic drives by, tap to start.

var _tap: Label
var _t: float = 0.0
var _road: RoadScene
var _go: bool = false

func _ready() -> void:
	music = "menu"
	super._ready()
	var vp := vsize()
	var sky := ColorRect.new()
	sky.color = Color("7fa6c8")
	UI.set_full_rect(sky)
	add_child(sky)
	# distant skyline from the biome art, blurred by scale
	var sk := Atlas.rect("biome_city_center", vp.x, 700)
	sk.stretch_mode = TextureRect.STRETCH_SCALE
	sk.position = Vector2(0, vp.y * 0.38 - 420)
	sk.modulate = Color(1, 1, 1, 0.9)
	add_child(sk)
	_road = RoadScene.new()
	_road.size = vp
	add_child(_road)
	_road.setup("city_center", vp.y * 0.70, 340)
	var logo := Atlas.rect("logo_title_block", 880, 620)
	logo.position = Vector2((vp.x - 880) * 0.5, vp.y * 0.07 + Game.safe_top * 0.5)
	add_child(logo)
	logo.pivot_offset = Vector2(440, 0)
	logo.scale = Vector2(1, 0.05)
	logo.rotation = -0.03
	var tw := create_tween()
	tw.set_parallel(true)
	tw.tween_property(logo, "scale", Vector2.ONE, 0.7).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT).set_delay(0.2)
	tw.tween_property(logo, "rotation", 0.0, 0.9).set_trans(Tween.TRANS_ELASTIC).set_ease(Tween.EASE_OUT).set_delay(0.2)
	var strap := Atlas.rect("logo_strapline", 560, 90)
	strap.position = Vector2((vp.x - 560) * 0.5, vp.y * 0.07 + 640 + Game.safe_top * 0.5)
	add_child(strap)
	UI.slide_in(strap, Vector2(0, 80), 0.8)
	var cone := Atlas.rect("logo_cone", 150, 200)
	cone.position = Vector2(vp.x - 230, vp.y * 0.07 + 480)
	add_child(cone)
	UI.pop_in(cone, 1.0)
	_tap = UI.label("TAP TO START", 70, UI.WHITE, true, HORIZONTAL_ALIGNMENT_CENTER, 12)
	_tap.position = Vector2(0, vp.y * 0.86)
	_tap.size = Vector2(vp.x, 100)
	add_child(_tap)
	var ver := UI.label("v1.0  -  A pixel traffic story", 26, Color(1, 1, 1, 0.65), false)
	ver.position = Vector2(0, vp.y - 60 - Game.safe_bottom)
	ver.size = Vector2(vp.x, 40)
	add_child(ver)
	var st := UI.btn("", "gray", Vector2(100, 90), func(): Game.go("settings"), 40, "icon_gear")
	st.position = Vector2(vp.x - 130, 24 + Game.safe_top)
	add_child(st)

func _process(dt: float) -> void:
	_t += dt
	_tap.modulate.a = 0.6 + 0.4 * sin(_t * 3.5)
	_tap.scale = Vector2.ONE * (1.0 + 0.03 * sin(_t * 3.5))
	_tap.pivot_offset = _tap.size * 0.5

func _gui_input(ev: InputEvent) -> void:
	if _go:
		return
	if ev is InputEventMouseButton and ev.pressed and ev.button_index == MOUSE_BUTTON_LEFT:
		_go = true
		Audio.sfx("horn")
		Audio.haptic(30)
		var f: Dictionary = Save.data["flags"]
		if not f["intro_seen"]:
			Game.go("intro")
		elif not f["created_character"]:
			Game.go("create")
		elif not f["tutorial_done"]:
			Game.go("battle", {"cfg": Game.build_cfg("tutorial")})
		else:
			Game.go("home")
