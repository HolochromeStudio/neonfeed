extends Screen
## Chapter cutscene: biome art with Ken-Burns, chapter title stamp, then a dialogue scene. args: chapter, scene, next, next_args.

var ch: int = 1
var scene: String = ""
var _t: float = 0.0

func init(a: Dictionary) -> void:
	args = a
	ch = int(a.get("chapter", 1))
	scene = String(a.get("scene", ""))

func _ready() -> void:
	music = "menu"
	super._ready()
	var vp := vsize()
	var C: Dictionary = Data.chapters[ch - 1]
	UI.paper_bg(self, "blue")
	var pic := Atlas.rect("biome_" + C["biome"], vp.x, vp.x * 150.0 / 270.0)
	pic.position = Vector2(0, vp.y * 0.5 + 120)
	add_child(pic)
	var frame := ColorRect.new()
	frame.color = UI.INK
	frame.position = Vector2(0, pic.position.y - 8); frame.size = Vector2(vp.x, 8)
	add_child(frame)
	var tw := create_tween()
	pic.modulate.a = 0.0
	tw.tween_property(pic, "modulate:a", 1.0, 0.6)
	var banner := Atlas.nine("ui_ribbon_red", 22)
	banner.size = Vector2(vp.x - 60, 240)
	banner.position = Vector2(30, vp.y * 0.28)
	add_child(banner)
	var l1 := UI.label("CHAPTER %d" % ch, 52, UI.WHITE, true, HORIZONTAL_ALIGNMENT_CENTER, 8)
	l1.size = Vector2(banner.size.x, 70); l1.position = Vector2(0, 20)
	banner.add_child(l1)
	var l2 := UI.label(C["name"].to_upper(), 92, UI.WHITE, true, HORIZONTAL_ALIGNMENT_CENTER, 12)
	l2.size = Vector2(banner.size.x, 110); l2.position = Vector2(0, 80)
	banner.add_child(l2)
	UI.stamp(banner, 0.3)
	var sub := UI.label(C["sub"], 48, UI.WHITE, true, HORIZONTAL_ALIGNMENT_CENTER, 8)
	sub.position = Vector2(0, vp.y * 0.28 + 260); sub.size = Vector2(vp.x, 60)
	add_child(sub)
	UI.slide_in(sub, Vector2(0, 40), 0.9)
	var t := create_tween()
	t.tween_interval(2.2)
	t.tween_callback(func(): Game.play_dialogue(scene, func(): _go_next()))

func _go_next() -> void:
	Game.go(String(args.get("next", "map")), args.get("next_args", {}), true, false)
