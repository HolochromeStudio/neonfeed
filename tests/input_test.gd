extends Node
## Simulated touch/mouse input on the real battle screen: tap DEPLOY, drag-to-merge, tap-to-inspect, pause button.
## godot --headless --path . res://tests/input_test.tscn -- --save=test_input.json --fresh
var failures := 0
func check(c: bool, m: String) -> void:
	print(("[ok]   " if c else "[FAIL] ") + m)
	if not c: failures += 1
func frames(n: int) -> void:
	for i in n: await get_tree().process_frame

func mouse(pos: Vector2, pressed: bool) -> void:
	var ev := InputEventMouseButton.new()
	ev.button_index = MOUSE_BUTTON_LEFT
	ev.pressed = pressed
	ev.position = pos
	ev.global_position = pos
	ev.button_mask = MOUSE_BUTTON_MASK_LEFT if pressed else 0
	get_viewport().push_input(ev)
func motion(pos: Vector2) -> void:
	var ev := InputEventMouseMotion.new()
	ev.position = pos
	ev.global_position = pos
	ev.button_mask = MOUSE_BUTTON_MASK_LEFT
	get_viewport().push_input(ev)

func _ready() -> void:
	get_window().size = Vector2i(1080, 1920)
	await get_tree().process_frame
	await get_tree().process_frame
	Game.setup(self)
	Audio.build_all()
	Save.data["flags"]["created_character"] = true
	Save.data["flags"]["tutorial_done"] = true
	var cfg := Game.build_cfg("story", {"chapter": 1, "level": 1})
	cfg["deck"] = ["taxi", "taxi", "taxi", "taxi", "taxi"]   # guarantee equal pairs
	Game.start_run(cfg)
	var n := 0
	while Game.screen_name != "battle" and n < 3000:
		await get_tree().process_frame; n += 1
	var b: Control = Game.current
	for i in 60:
		for oc in Game.overlay.get_children():
			if oc is DialogueBox: oc._finish()
		await get_tree().process_frame
	b.sim.sp = 500.0
	# tap DEPLOY with real input events
	var dp: Vector2 = b.deploy_btn.global_position + b.deploy_btn.size * 0.5
	mouse(dp, true); await frames(3)
	mouse(dp, false); await frames(10)
	check(b.sim.deploy_count == 1, "tapping DEPLOY (input events) deploys a vehicle")
	mouse(dp, true); await frames(3); mouse(dp, false); await frames(40)
	check(b.sim.deploy_count == 2 and b.sim.units.size() == 2, "second deploy")
	# drag unit A onto unit B
	var ua: BattleSim.SimUnit = b.sim.units[0]
	var ub: BattleSim.SimUnit = b.sim.units[1]
	var pa: Vector2 = b.view.from_field(ua.pos) + b.view.position
	var pb: Vector2 = b.view.from_field(ub.pos) + b.view.position
	mouse(pa, true); await frames(2)
	motion(pa.lerp(pb, 0.3)); await frames(2)
	motion(pa.lerp(pb, 0.8)); await frames(2)
	motion(pb); await frames(2)
	check(b._dragging, "dragging a vehicle starts a drag")
	mouse(pb, false); await frames(40)
	check(b.sim.stats["merges"] == 1 and b.sim.units.size() == 1, "dropping on an equal vehicle merges (rank %d)" % b.sim.units[0].rank)
	# tap a unit -> info panel
	var u: BattleSim.SimUnit = b.sim.units[0]
	var pu: Vector2 = b.view.from_field(u.pos) + b.view.position
	mouse(pu, true); await frames(2); mouse(pu, false); await frames(20)
	check(b.info_panel != null and is_instance_valid(b.info_panel), "tapping a vehicle opens its info panel")
	# move to empty slot
	b._hide_info()
	var empties: Array = b.sim.empty_slots(0)
	var target_slot: int = empties[0]
	var pt: Vector2 = b.view.from_field(b.sim.slot_pos(target_slot)) + b.view.position
	mouse(pu, true); await frames(2); motion(pu.lerp(pt, 0.5)); await frames(2); motion(pt); await frames(2); mouse(pt, false); await frames(40)
	check(b.sim.units[0].slot == target_slot, "dragging to an empty slot moves the vehicle")
	# pause button
	var pbn: Control = b.hud.get_child(0)
	var pp: Vector2 = pbn.global_position + pbn.size * 0.5
	mouse(pp, true); await frames(3); mouse(pp, false); await frames(10)
	check(b.paused, "pause button pauses")
	print("INPUT DONE failures=", failures)
	get_tree().quit(1 if failures > 0 else 0)
