class_name PvpMini
extends Control
## Compact live view of the opponent's board: road with enemy dots, city HP, wave and board fill.

var sim: BattleSim
var opp: Dictionary = {}

func setup(s: BattleSim, o: Dictionary) -> void:
	sim = s
	opp = o
	mouse_filter = Control.MOUSE_FILTER_IGNORE

func _process(_dt: float) -> void:
	queue_redraw()

func _draw() -> void:
	if sim == null:
		return
	draw_style_box(_box(), Rect2(Vector2.ZERO, size))
	var k := (size.x - 24.0) / 1080.0
	var off := Vector2(12, 40)
	# road
	var pts := PackedVector2Array()
	for p in sim.path_pts:
		pts.append(off + p * k)
	draw_polyline(pts, Color("57534f"), 14.0)
	for e in sim.enemies:
		if e.alive:
			draw_circle(off + e.pos * k, 5.0 if not e.boss else 9.0, Color("e9ab4b") if not e.elite else Color("ff6a5a"))
	# units occupancy
	for u in sim.units:
		var p2 := off + Vector2(u.pos.x * k, 200.0 + (u.pos.y - 960.0) * k * 0.5)
		draw_circle(p2, 5.0, Data.rarity_color(u.def["rarity"]))
	var f := UI.font_title
	draw_string(f, Vector2(10, 28), String(opp.get("name", "Rival")), HORIZONTAL_ALIGNMENT_LEFT, 180, 22, Color.WHITE)
	draw_string(f, Vector2(size.x - 120, 28), "HP %d  W%d" % [maxi(0, sim.city_hp), sim.wave], HORIZONTAL_ALIGNMENT_RIGHT, 110, 22, Color("ffe08a"))

func _box() -> StyleBox:
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.12, 0.1, 0.1, 0.85)
	sb.set_corner_radius_all(14)
	sb.border_color = Color("e2d0b0")
	sb.set_border_width_all(3)
	return sb
