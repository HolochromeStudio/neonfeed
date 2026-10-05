extends Screen
## Boot: logo + loading bar while the synthesised audio is generated.

var _bar_fill: NinePatchRect
var _bar_w: float = 640.0
var _tip: Label
var _done: bool = false
var _t: float = 0.0
var _prog: float = 0.0

func _ready() -> void:
	music = ""
	super._ready()
	UI.paper_bg(self)
	var vp := vsize()
	var logo := Atlas.rect("logo_title_block", 800, 560)
	logo.position = Vector2((vp.x - 800) * 0.5, vp.y * 0.18)
	add_child(logo)
	UI.pop_in(logo, 0.1)
	var bar_bg := Atlas.nine("ui_bar_bg", 28)
	bar_bg.size = Vector2(_bar_w, 56)
	bar_bg.position = Vector2((vp.x - _bar_w) * 0.5, vp.y * 0.62)
	add_child(bar_bg)
	_bar_fill = Atlas.nine("ui_bar_fill_yellow", 28)
	_bar_fill.size = Vector2(40, 56)
	_bar_fill.position = bar_bg.position
	add_child(_bar_fill)
	var tips := ["Merging doesn't guarantee the same vehicle - risk it for power!", "Rarity isn't power. Commons carry great builds.", "Empty slots can be an asset... with the right upgrade.",
		"Build synergies: three Taxis, or Police + Fire + Ambulance.", "Row, column and adjacency all matter for auras."]
	_tip = UI.label("TIP: " + tips[randi() % tips.size()], 32, UI.WHITE, false)
	_tip.position = Vector2(60, vp.y * 0.62 + 90)
	_tip.size = Vector2(vp.x - 120, 100)
	_tip.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	add_child(_tip)
	var cone := Atlas.rect("logo_cone", 120, 160)
	cone.position = Vector2(vp.x * 0.5 - 60, vp.y * 0.62 - 190)
	add_child(cone)
	cone.pivot_offset = Vector2(60, 160)
	var tw := create_tween().set_loops()
	tw.tween_property(cone, "rotation", 0.12, 0.4).set_trans(Tween.TRANS_SINE)
	tw.tween_property(cone, "rotation", -0.12, 0.8).set_trans(Tween.TRANS_SINE)
	tw.tween_property(cone, "rotation", 0.0, 0.4).set_trans(Tween.TRANS_SINE)
	Save.refresh_quests()

func _process(dt: float) -> void:
	_t += dt
	if _done:
		return
	var t0 := Time.get_ticks_msec()
	while Time.get_ticks_msec() - t0 < 12:
		_prog = Audio.build_step()
		if _prog >= 1.0:
			break
	_bar_fill.size.x = maxf(40.0, _bar_w * _prog)
	if _prog >= 1.0 and _t > 0.6:
		_done = true
		if Dev.goto_screen != "":
			Game.dev_goto()
		else:
			Game.go("title", {}, true, false)
