class_name PvpMini
extends Control
## Compact live view of the opponent's board: road with enemy dots, city HP, wave and board fill.

var match_: PvpMatch
var opp: Dictionary = {}

func setup(m: PvpMatch, o: Dictionary) -> void:
	match_ = m
	opp = o
	mouse_filter = Control.MOUSE_FILTER_IGNORE

func _process(_dt: float) -> void:
	queue_redraw()

func _draw() -> void:
	if match_ == null:
		return
	draw_style_box(_box(), Rect2(Vector2.ZERO, size))
	var f := UI.font_title
	var o: Dictionary = match_.opp
	draw_string(f, Vector2(18, 42), "RIVAL: %s" % String(o.get("name", "Rival")), HORIZONTAL_ALIGNMENT_LEFT, 360, 30, Color.WHITE)
	draw_string(f, Vector2(size.x - 560, 42), "HP %d   WAVE %d   VEHICLES %d   ON ROAD %d" % [maxi(0, int(o["hp"])), int(o["wave"]), int(o["units"]), int(o["enemies"])], HORIZONTAL_ALIGNMENT_RIGHT, 540, 28, Color("ffe08a"))
	draw_rect(Rect2(18, 54, size.x - 36, 6), Color(0, 0, 0, 0.5))
	draw_rect(Rect2(18, 54, (size.x - 36) * float(o["lead"]), 6), Color("ff6a5a"))

func _box() -> StyleBox:
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.12, 0.1, 0.1, 0.85)
	sb.set_corner_radius_all(14)
	sb.border_color = Color("e2d0b0")
	sb.set_border_width_all(3)
	return sb
