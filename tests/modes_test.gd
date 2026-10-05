extends Node
## All game modes end-to-end (short variants) in a headless session.  godot --headless --path . res://tests/modes_test.tscn -- --save=test_modes.json --fresh
var failures: int = 0
func check(cond: bool, msg: String) -> void:
	print(("[ok]   " if cond else "[FAIL] ") + msg)
	if not cond: failures += 1
func frames(n: int) -> void:
	for i in n:
		await get_tree().process_frame
func idle() -> void:
	var n := 0
	while Game._transitioning and n < 600:
		await get_tree().process_frame
		n += 1
func wait_screen(name: String, max_frames: int = 20000) -> bool:
	var n := 0
	while Game.screen_name != name and n < max_frames:
		await get_tree().process_frame
		n += 1
	return Game.screen_name == name

func _ready() -> void:
	await get_tree().process_frame
	Game.setup(self)
	Audio.build_all()
	Save.data["flags"]["created_character"] = true
	Save.data["flags"]["tutorial_done"] = true
	Game.go("home", {}, false)
	await frames(3)
	# --- other modes end-to-end (short variants)
	for m in ["survival", "pvp", "coop"]:
		await idle()
		var mc := Game.build_cfg(m, {"opponent": {"name": "Bot", "skill": 0.5, "deck": ["taxi", "compact", "pickup", "city_bus", "delivery_van"]}})
		if m == "survival": mc["city_hp"] = 2; mc["difficulty"] = 8.0
		if m == "pvp": mc["waves"] = 2
		if m == "coop": mc["city_hp"] = 2; mc["waves"] = 3; mc["difficulty"] = 8.0
		Game.start_run(mc)
		await wait_screen("battle")
		var b: Control = Game.current
		b.bot = BotAI.new(0, 0.7, true) if m != "coop" else null
		b.speed = 20.0
		var t0 := Time.get_ticks_msec()
		while Game.screen_name == "battle" and Time.get_ticks_msec() - t0 < 150000 and is_instance_valid(b):
			for oc in Game.overlay.get_children():
				if oc is DialogueBox: oc._finish()
			if b.sim.state == "offer" and b.offer_layer != null:
				b.sim.choose_offer(0); b._close_offer()
			if m == "coop" and b.coop != null and b.sim.can_deploy(0):
				b.coop.local_action({"a": "deploy"})
			await frames(2)
		await wait_screen("results", 20000)
		check(Game.screen_name == "results", "%s mode reaches results (%s, wave %s)" % [m, Game.last_summary.get("result", "?"), Game.last_summary.get("wave", "?")])
	check(int(Save.data["survival"]["runs"]) >= 1, "survival run recorded")
	check(int(Save.data["pvp"]["wins"]) + int(Save.data["pvp"]["losses"]) >= 1, "pvp result recorded")
	check(Save.stat("coop_played") >= 1, "coop result recorded")
	print("MODES DONE failures=", failures)
	get_tree().quit(1 if failures > 0 else 0)
