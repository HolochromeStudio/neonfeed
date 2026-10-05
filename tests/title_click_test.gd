extends Node
## A real click on the title screen must leave it.  godot --headless --path . res://tests/title_click_test.tscn -- --save=t.json --fresh
func frames(n: int) -> void:
	for i in n: await get_tree().process_frame
func _ready() -> void:
	get_window().size = Vector2i(1080, 1920)
	await frames(2)
	Game.setup(self)
	Game.go("title", {}, false)
	await frames(40)
	print("screen before: ", Game.screen_name)
	var ev := InputEventMouseButton.new()
	ev.button_index = MOUSE_BUTTON_LEFT; ev.pressed = true; ev.position = Vector2(540, 900); ev.global_position = ev.position
	get_viewport().push_input(ev)
	await frames(10)
	var up := ev.duplicate(); up.pressed = false
	get_viewport().push_input(up)
	await frames(120)
	print("screen after: ", Game.screen_name)
	print("hovered: ", get_viewport().gui_get_hovered_control())
	get_tree().quit(0 if Game.screen_name != "title" else 1)
