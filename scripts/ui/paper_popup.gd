class_name PaperPopup
extends Control
## Modal paper popup with dim backdrop, unfold animation and a row of buttons.

signal closed

var panel: NinePatchRect
var content: VBoxContainer
var _dim: ColorRect
var close_on_dim: bool = false

func build(title: String, body: Control, buttons: Array, size_px: Vector2) -> void:
	UI.set_full_rect(self)
	mouse_filter = Control.MOUSE_FILTER_STOP
	_dim = ColorRect.new()
	_dim.color = Color(0.08, 0.06, 0.05, 0.62)
	UI.set_full_rect(_dim)
	add_child(_dim)
	_dim.gui_input.connect(func(ev):
		if close_on_dim and ev is InputEventMouseButton and ev.pressed:
			close())
	var vp := get_viewport_rect().size
	panel = UI.panel("paper", size_px, 46)
	panel.position = (vp - size_px) * 0.5
	add_child(panel)
	# header ribbon
	var rb := Atlas.nine("ui_ribbon_red", 22)
	rb.size = Vector2(minf(size_px.x - 100, 640), 92)
	rb.position = Vector2((size_px.x - rb.size.x) * 0.5, -40)
	panel.add_child(rb)
	var tl := UI.label(title, 48, UI.WHITE, true, HORIZONTAL_ALIGNMENT_CENTER, 6)
	tl.size = rb.size
	rb.add_child(tl)
	var tape := TextureRect.new()
	tape.texture = Atlas.tex("ui_tape")
	tape.size = Vector2(150, 48); tape.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	tape.position = Vector2(size_px.x * 0.5 - 75 - 250, -62); tape.rotation = deg_to_rad(-8)
	panel.add_child(tape)
	var tape2 := TextureRect.new()
	tape2.texture = Atlas.tex("ui_tape_b")
	tape2.size = Vector2(150, 48); tape2.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	tape2.position = Vector2(size_px.x * 0.5 - 75 + 250, -58); tape2.rotation = deg_to_rad(10)
	panel.add_child(tape2)
	content = VBoxContainer.new()
	content.position = Vector2(50, 80)
	content.size = Vector2(size_px.x - 100, size_px.y - 220)
	content.alignment = BoxContainer.ALIGNMENT_CENTER
	content.add_theme_constant_override("separation", 16)
	panel.add_child(content)
	if body:
		content.add_child(body)
	if buttons.is_empty():
		buttons = [{"text": "OK", "color": "teal"}]
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 24)
	row.position = Vector2(30, size_px.y - 150)
	row.size = Vector2(size_px.x - 60, 110)
	panel.add_child(row)
	var bw := minf(320.0, (size_px.x - 60 - 24 * (buttons.size() - 1)) / buttons.size())
	for b in buttons:
		var btn := UI.btn(b["text"], b.get("color", "teal"), Vector2(bw, 100), Callable(), 40)
		btn.pressed.connect(func():
			var keep: bool = b.get("keep", false)
			if b.has("cb"):
				b["cb"].call()
			if not keep:
				close())
		row.add_child(btn)
	Audio.sfx("whoosh", 1.3, -8)
	UI.unfold(panel)
	_dim.modulate.a = 0.0
	create_tween().tween_property(_dim, "modulate:a", 1.0, 0.2)

func close() -> void:
	closed.emit()
	var tw := create_tween()
	tw.set_parallel(true)
	tw.tween_property(panel, "scale", Vector2(0.9, 0.9), 0.15)
	tw.tween_property(self, "modulate:a", 0.0, 0.15)
	tw.chain().tween_callback(queue_free)
