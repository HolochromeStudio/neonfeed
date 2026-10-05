class_name Screen
extends Control
## Base class for all full-screen pages.

var args: Dictionary = {}
var music: String = "menu"

func _ready() -> void:
	UI.set_full_rect(self)
	mouse_filter = Control.MOUSE_FILTER_STOP
	Audio.music(music)

## Called by Game after instancing (args set, not yet in tree).
func init(a: Dictionary) -> void:
	args = a

func top_inset() -> float:
	return Game.safe_top

func bottom_inset() -> float:
	return Game.safe_bottom

func vsize() -> Vector2:
	return get_viewport_rect().size

## Standard top bar (wallet pills + level), returns the bar control.
func add_topbar(show_back: bool = false, title: String = "") -> Control:
	var bar := Control.new()
	bar.set_anchors_and_offsets_preset(Control.PRESET_TOP_WIDE)
	bar.offset_top = top_inset() + 10
	bar.offset_bottom = bar.offset_top + 90
	bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(bar)
	var x := 24.0
	if show_back:
		var b := UI.btn("", "orange", Vector2(96, 80), func(): Game.back(), 40, "icon_remote")
		b.position = Vector2(x, 4)
		b.label.text = "<"
		if b.icon_rect:
			b.icon_rect.visible = false
		b.label.position = b._base_text_pos
		bar.add_child(b)
		x += 110
	if title != "":
		var t := UI.label(title, 50, UI.WHITE, true, HORIZONTAL_ALIGNMENT_LEFT, 8)
		t.position = Vector2(x, 0)
		t.size = Vector2(500, 90)
		bar.add_child(t)
	var vw := vsize().x
	var coin := UI.resource_pill("coins", 210)
	coin.position = Vector2(vw - 24 - 210 * 3 - 20, 10)
	var gem := UI.resource_pill("gems", 200)
	gem.position = Vector2(vw - 24 - 210 - 200 - 10, 10)
	var tick := UI.resource_pill("tickets", 150)
	tick.position = Vector2(vw - 24 - 150, 10)
	for p in [coin, gem, tick]:
		bar.add_child(p)
	return bar
