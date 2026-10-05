class_name Doll
extends Node2D
## Modular paper-doll player character. Layers are separate sprites so we can animate hinge-style (arms, head, legs).
## States: idle, walk, run, talk, happy, angry, worried, surprised, think, point, celebrate, defeat, look.

var look: Dictionary = {}
var state: String = "idle"
var t: float = 0.0
var talking: bool = false
var facing: float = 1.0
var _blink_t: float = 2.0
var _blink: float = 0.0
var _mood: String = "neutral"
var _look_t: float = 0.0
var parts: Dictionary = {}
var _head: Node2D
var _body: Node2D
var _arm_l: Node2D
var _arm_r: Node2D
var _leg_l: Node2D
var _leg_r: Node2D
var _root: Node2D
var _eyes: Sprite2D
var _mouth: Sprite2D
var _extra: Node2D
var _rng := RandomNumberGenerator.new()
var _mouth_t: float = 0.0
var _bubble: Sprite2D
var _event_t: float = 0.0

const PX := 4.0   # one art pixel on screen

static func tint(c: Color) -> Color:
	return c

func _init(l: Dictionary = {}) -> void:
	look = l if not l.is_empty() else Save.look()

func _ready() -> void:
	_rng.randomize()
	build()

func _spr(key: String, pos: Vector2, parent: Node2D, col: Color = Color.WHITE) -> Sprite2D:
	var s := Sprite2D.new()
	s.texture = Atlas.tex(key)
	s.position = pos * PX
	s.modulate = col
	parent.add_child(s)
	return s

func _cos(id: String) -> Dictionary:
	return Data.cosmetics_by_id.get(id, {})

## Geometry is in art pixels relative to the feet (y up is negative); sprites are 4x upscaled pixel art tinted per cosmetic.
func build() -> void:
	for c in get_children():
		c.queue_free()
	_root = Node2D.new(); add_child(_root)
	var shadow := _spr("fx_shadow_blob", Vector2(0, 0), _root, Color(0, 0, 0, 0.3)); shadow.scale = Vector2(0.9, 0.9)
	var skin: Color = _cos(look.get("skin", "skin_1")).get("color", Color("e0a97a"))
	var top_c: Color = _cos(look.get("top", "top_0")).get("color", Color("5b79b0"))
	var bot_c: Color = _cos(look.get("bottom", "bot_0")).get("color", Color("3f5f8f"))
	var shoe_c: Color = _cos(look.get("shoes", "shoe_0")).get("color", Color("3a2e2a"))
	_body = Node2D.new(); _root.add_child(_body)
	var acc: String = look.get("accessory", "acc_none")
	var accd := _cos(acc)
	if acc == "acc_backpack":
		_spr("doll_backpack", Vector2(0, -21), _body)
	_leg_l = Node2D.new(); _leg_l.position = Vector2(-3, -13) * PX; _body.add_child(_leg_l)
	_leg_r = Node2D.new(); _leg_r.position = Vector2(3, -13) * PX; _body.add_child(_leg_r)
	for lg in [_leg_l, _leg_r]:
		_spr("doll_leg", Vector2(0, 6.5), lg, bot_c)
		_spr("doll_shoe", Vector2(0.5, 10.5), lg, shoe_c)
	_arm_r = Node2D.new(); _arm_r.position = Vector2(8.5, -25.5) * PX; _body.add_child(_arm_r)
	_spr("doll_arm", Vector2(0, 6.5), _arm_r, top_c)
	_spr("doll_hand", Vector2(0, 13), _arm_r, skin)
	_spr("doll_torso", Vector2(0, -20), _body, top_c)
	_arm_l = Node2D.new(); _arm_l.position = Vector2(-8.5, -25.5) * PX; _body.add_child(_arm_l)
	_spr("doll_arm", Vector2(0, 6.5), _arm_l, top_c)
	_spr("doll_hand", Vector2(0, 13), _arm_l, skin)
	_head = Node2D.new(); _head.position = Vector2(0, -23) * PX; _body.add_child(_head)   # hinge at the chin
	_spr("doll_ear", Vector2(-12.5, -10.5), _head, skin)
	_spr("doll_ear", Vector2(12.5, -10.5), _head, skin)
	_spr("doll_head", Vector2(0, -11), _head, skin)
	_spr("doll_cheek", Vector2(-6, -5.5), _head)
	_spr("doll_cheek", Vector2(6, -5.5), _head)
	_eyes = _spr("doll_eyes_open", Vector2(0, -10), _head)
	_mouth = _spr("doll_mouth_neutral", Vector2(0, -4), _head)
	_extra = Node2D.new(); _head.add_child(_extra)
	var g: String = look.get("glasses", "glasses_none")
	if _cos(g).get("key", "") != "":
		_spr(_cos(g)["key"], Vector2(0, -11), _head)
	var h: String = look.get("hair", "hair_none")
	if _cos(h).get("key", "") != "":
		_spr(_cos(h)["key"], Vector2(0, -11), _head)
	var hat: String = look.get("hat", "hat_none")
	if _cos(hat).get("key", "") != "":
		_spr(_cos(hat)["key"], Vector2(0, -11), _head)
	if accd.get("key", "") != "" and acc != "acc_backpack" and acc != "acc_none":
		var key: String = accd["key"]
		if key.begins_with("icon_"):
			var s := _spr(key, Vector2(14, -30), _head)
			s.scale = Vector2(0.6, 0.6)
		else:
			_spr(key, Vector2(0, -11), _head)
	_bubble = Sprite2D.new(); _bubble.visible = false; _bubble.position = Vector2(18, -52) * PX; add_child(_bubble)

func set_state(s: String) -> void:
	state = s
	_event_t = 0.0

func set_mood(m: String) -> void:
	_mood = m
	if not is_inside_tree() or _eyes == null:
		return
	var eye_key := {"neutral": "open", "happy": "happy", "angry": "angry", "worried": "worried", "surprised": "surprised", "think": "think", "point": "open", "look": "look"}.get(m, "open")
	_eyes.texture = Atlas.tex("doll_eyes_" + eye_key)
	var mk := {"neutral": "neutral", "happy": "smile", "angry": "frown", "worried": "wobble", "surprised": "o", "think": "neutral", "point": "smile", "look": "neutral"}.get(m, "neutral")
	_mouth.texture = Atlas.tex("doll_mouth_" + mk)
	_bubble.visible = true
	match m:
		"worried":
			_bubble.texture = Atlas.tex("fx_drop"); _bubble.scale = Vector2(1.0, 1.0); _bubble.position = Vector2(16, -44) * PX
		"surprised":
			_bubble.texture = Atlas.tex("icon_alert"); _bubble.scale = Vector2(0.8, 0.8); _bubble.position = Vector2(17, -52) * PX
		"think":
			_bubble.texture = Atlas.tex("icon_remote"); _bubble.scale = Vector2(0.01, 0.01); _bubble.visible = false
		"happy":
			_bubble.texture = Atlas.tex("fx_sparkle"); _bubble.scale = Vector2(0.8, 0.8); _bubble.position = Vector2(-16, -50) * PX
		"angry":
			_bubble.texture = Atlas.tex("fx_flame"); _bubble.scale = Vector2(0.9, 0.9); _bubble.position = Vector2(16, -50) * PX
		_:
			_bubble.visible = false

func _process(dt: float) -> void:
	if _root == null:
		return
	t += dt
	_event_t += dt
	_blink_t -= dt
	if _blink_t <= 0.0:
		_blink = 0.12
		_blink_t = _rng.randf_range(1.8, 4.2)
	if _blink > 0.0:
		_blink -= dt
		if _mood in ["neutral", "point", "look"]:
			_eyes.texture = Atlas.tex("doll_eyes_blink")
		if _blink <= 0.0:
			set_mood(_mood)
	if talking:
		_mouth_t -= dt
		if _mouth_t <= 0.0:
			_mouth_t = 0.11
			_mouth.texture = Atlas.tex("doll_mouth_talk_a" if _mouth.texture == Atlas.tex("doll_mouth_talk_b") or _mouth.texture != Atlas.tex("doll_mouth_talk_a") else "doll_mouth_talk_b")
	var bob := 0.0
	var lean := 0.0
	var arm_l := 0.0
	var arm_r := 0.0
	var leg_l := 0.0
	var leg_r := 0.0
	var head_rot := 0.0
	var squash := 1.0
	match state:
		"idle", "talk":
			bob = snappedf(sin(t * 2.4) * 2.5, 4.0)
			squash = 1.0 + sin(t * 2.4) * 0.012
			arm_l = sin(t * 2.4 + 1.0) * 0.06; arm_r = -sin(t * 2.4 + 1.0) * 0.06
			head_rot = sin(t * 1.3) * 0.03
		"walk", "run":
			var sp := 8.0 if state == "walk" else 13.0
			var amp := 0.5 if state == "walk" else 0.8
			leg_l = sin(t * sp) * amp; leg_r = -sin(t * sp) * amp
			arm_l = -sin(t * sp) * amp * 0.9; arm_r = sin(t * sp) * amp * 0.9
			bob = -absf(sin(t * sp)) * (6.0 if state == "walk" else 11.0)
			lean = 0.05 if state == "run" else 0.0
		"happy", "celebrate":
			var j := absf(sin(t * 7.0))
			bob = -j * 26.0
			arm_l = -2.6 + sin(t * 14.0) * 0.25; arm_r = 2.6 - sin(t * 14.0) * 0.25
			squash = 1.0 + (0.08 if j < 0.15 else -0.02)
			head_rot = sin(t * 7.0) * 0.06
		"angry":
			bob = sin(t * 30.0) * 2.0
			arm_l = 0.5; arm_r = -0.5
			head_rot = sin(t * 25.0) * 0.04
		"worried":
			bob = sin(t * 5.0) * 2.0
			arm_l = -1.0 + sin(t * 8.0) * 0.1; arm_r = 1.0 - sin(t * 8.0) * 0.1
			head_rot = sin(t * 2.0) * 0.08
		"surprised":
			var k := minf(_event_t / 0.25, 1.0)
			bob = -sin(k * PI) * 30.0 if _event_t < 0.3 else sin(t * 2.0) * 1.5
			arm_l = -0.8; arm_r = 0.8
			squash = 1.0 + (0.0 if _event_t > 0.3 else -sin(k * PI) * 0.1)
		"think":
			bob = sin(t * 1.8) * 2.0
			arm_r = 2.2 + sin(t * 1.5) * 0.05
			head_rot = 0.12
		"point":
			arm_l = -1.6 + sin(t * 6.0) * 0.05
			bob = sin(t * 2.2) * 2.0
			lean = 0.04
		"defeat":
			bob = 6.0
			lean = -0.12
			arm_l = 0.15; arm_r = -0.15
			head_rot = -0.2
			squash = 0.96
		"look":
			head_rot = sin(t * 1.2) * 0.2
			bob = sin(t * 2.4) * 2.0
	_body.position.y = bob
	_body.rotation = lean * facing
	_body.scale = Vector2(1.0 / squash, squash)
	_arm_l.rotation = arm_l
	_arm_r.rotation = arm_r
	_leg_l.rotation = leg_l
	_leg_r.rotation = leg_r
	_head.rotation = head_rot
	_root.scale.x = facing
