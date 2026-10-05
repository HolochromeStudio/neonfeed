class_name PaperButton
extends Control
## Cardboard button: presses inward, shadow compresses, releases with a small overshoot.

signal pressed

var label: Label
var icon_rect: TextureRect
var _bg: NinePatchRect
var _color: String = "teal"
var _down: bool = false
var enabled: bool = true
var _base_text_pos: Vector2 = Vector2.ZERO
var sfx_name: String = "click"
var _tw: Tween
var badge: Control

func setup(text: String, color: String, sz: Vector2, font_size: int, icon_key: String = "") -> void:
	_color = color
	custom_minimum_size = sz
	size = sz
	pivot_offset = sz * 0.5
	_bg = Atlas.nine("ui_btn_%s_up" % color, 40)
	_bg.size = sz + Vector2(0, 0)
	add_child(_bg)
	label = UI.label(text, font_size, UI.INK if color in ["yellow", "mint"] else UI.WHITE, true)
	label.size = sz - Vector2(10, 14)
	label.position = Vector2(5, 2)
	label.clip_text = false
	label.autowrap_mode = TextServer.AUTOWRAP_OFF
	if color not in ["yellow", "mint"]:
		label.add_theme_constant_override("outline_size", 4)
		label.add_theme_color_override("font_outline_color", UI.INK)
	add_child(label)
	_base_text_pos = label.position
	if icon_key != "":
		icon_rect = UI.icon(icon_key, minf(sz.y * 0.62, 70))
		icon_rect.position = Vector2(sz.x * 0.08, (sz.y - icon_rect.size.y) * 0.5)
		add_child(icon_rect)
		label.position.x += icon_rect.size.x * 0.5
		_base_text_pos = label.position
	mouse_filter = Control.MOUSE_FILTER_STOP

func set_enabled(v: bool) -> void:
	enabled = v
	_bg.texture = Atlas.tex("ui_btn_%s_up" % ("disabled" if not v else _color)).atlas
	_bg.region_rect = Atlas.tex("ui_btn_%s_up" % ("disabled" if not v else _color)).region
	modulate = Color(1, 1, 1, 1) if v else Color(0.85, 0.85, 0.85, 0.9)

func set_text(t: String) -> void:
	label.text = t

func _set_tex(key: String) -> void:
	var t := Atlas.tex(key)
	_bg.texture = t.atlas
	_bg.region_rect = t.region

func _gui_input(ev: InputEvent) -> void:
	if not enabled:
		if ev is InputEventMouseButton and ev.pressed:
			Audio.sfx("error")
		return
	if ev is InputEventMouseButton and ev.button_index == MOUSE_BUTTON_LEFT:
		if ev.pressed:
			_press()
		elif _down:
			var inside := Rect2(Vector2.ZERO, size).has_point(ev.position)
			_release(inside)
	elif ev is InputEventScreenTouch:
		pass

func _press() -> void:
	_down = true
	_set_tex("ui_btn_%s_down" % _color)
	label.position = _base_text_pos + Vector2(0, 5)
	if icon_rect:
		icon_rect.position.y += 5
	if _tw:
		_tw.kill()
	_tw = create_tween()
	_tw.tween_property(self, "scale", Vector2(0.965, 0.95), 0.06)
	Audio.sfx(sfx_name)
	Audio.haptic(8)

func _release(fire: bool) -> void:
	_down = false
	_set_tex("ui_btn_%s_up" % _color)
	label.position = _base_text_pos
	if icon_rect:
		icon_rect.position.y -= 5
	if _tw:
		_tw.kill()
	_tw = create_tween()
	_tw.tween_property(self, "scale", Vector2(1.05, 1.06), 0.08)
	_tw.tween_property(self, "scale", Vector2.ONE, 0.18).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	if fire:
		pressed.emit()

func _notification(what: int) -> void:
	if what == NOTIFICATION_MOUSE_EXIT and _down:
		_release(false)

func add_badge(text: String = "!") -> void:
	if badge:
		badge.queue_free()
	badge = Control.new()
	var bgc := Atlas.nine("ui_panel_red", 28)
	bgc.size = Vector2(46, 46)
	badge.add_child(bgc)
	var l := UI.label(text, 28, UI.WHITE, true)
	l.size = Vector2(46, 46)
	badge.add_child(l)
	badge.position = Vector2(size.x - 40, -14)
	badge.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(badge)

func clear_badge() -> void:
	if badge:
		badge.queue_free()
		badge = null
