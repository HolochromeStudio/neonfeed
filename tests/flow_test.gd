extends Node
## End-to-end first-run flow in a headless game session (no input devices):
## boot -> title -> intro -> create character -> tutorial (deploy, merge, upgrade) -> results -> home -> campaign level -> results.
## godot --headless --path . res://tests/flow_test.tscn -- --save=test_flow.json --fresh
var log_lines: Array = []
var failures: int = 0

func _ready() -> void:
	await get_tree().process_frame
	_run()

func check(cond: bool, msg: String) -> void:
	if cond:
		print("[ok]   ", msg)
	else:
		print("[FAIL] ", msg)
		failures += 1

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

func _run() -> void:
	Game.setup(self)
	Audio.build_all()
	check(Save.data["flags"]["intro_seen"] == false, "fresh save: intro not seen")
	# --- intro
	Game.go("intro", {}, false)
	await frames(5)
	check(Game.screen_name == "intro", "intro screen opens")
	Game.current._end()
	await wait_screen("create")
	check(Game.screen_name == "create", "intro -> create character")
	# --- character creation
	var c := Game.current
	c.name_edit.text = "Tester"
	c._tap_item(Data.cosmetics_by_id["hat_cap_red_blue"], true)
	check(Save.look()["hat"] == "hat_cap_red_blue", "customization equips a hat")
	c._finish_create()
	await frames(10)
	check(Save.data["profile"]["name"] == "Tester" and Save.data["flags"]["created_character"], "character saved")
	# dialogue overlay is up: tap through it
	var guard := 0
	while Game.screen_name != "battle" and guard < 80:
		for ch in Game.overlay.get_children():
			if ch is DialogueBox:
				ch._next_line()
		await frames(3)
		guard += 1
	await wait_screen("battle")
	check(Game.screen_name == "battle", "welcome dialogue -> tutorial battle")
	var b := Game.current
	check(b.cfg["mode"] == "tutorial", "tutorial mode")
	# tutorial intro dialogue
	guard = 0
	while guard < 40:
		var any := false
		for ch in Game.overlay.get_children():
			if ch is DialogueBox:
				ch._next_line(); any = true
		if not any: break
		await frames(3)
		guard += 1
	await frames(5)
	check(b._tut_step == 1, "tutorial step 1: deploy hint")
	b._on_deploy()
	await frames(3)
	check(b.sim.deploy_count == 1, "deploy spends SP and spawns a vehicle")
	await frames(5)
	for ch in Game.overlay.get_children():
		if ch is DialogueBox: ch._finish()
	b._on_deploy(); await frames(2); b._on_deploy(); await frames(5)
	for ch in Game.overlay.get_children():
		if ch is DialogueBox: ch._finish()
	await frames(5)
	var pairs: Array = b.sim.mergeable_pairs(0)
	check(not pairs.is_empty(), "tutorial guarantees a mergeable pair (forced taxis)")
	if not pairs.is_empty():
		b.sim.move_unit(pairs[0][0], pairs[0][1].slot)
	await frames(30)
	check(b.sim.stats["merges"] == 1, "merge performed")
	# let the tutorial run with the bot
	b.bot = BotAI.new(0, 1.0, true)
	b.speed = 6.0
	var t0 := Time.get_ticks_msec()
	while Game.screen_name == "battle" and Time.get_ticks_msec() - t0 < 120000:
		for ch in Game.overlay.get_children():
			if ch is DialogueBox: ch._finish()
		if b.sim.state == "offer" and b.offer_layer != null:
			b.sim.choose_offer(0); b._close_offer()
		await frames(2)
	await wait_screen("results", 20000)
	check(Game.screen_name == "results", "tutorial ends on results (%s)" % Game.last_summary.get("result", "?"))
	check(Save.data["flags"]["tutorial_done"], "tutorial flag set")
	check(Save.owns("hatchback"), "tutorial unlocks Hatchback")
	for ch in Game.overlay.get_children():
		if ch is DialogueBox: ch._finish()
	# --- home + a campaign level
	await idle()
	Game.go("home", {}, false)
	await frames(5)
	check(Game.screen_name == "home", "home screen")
	var cfg := Game.build_cfg("story", {"chapter": 1, "level": 1})
	await idle()
	Game.start_run(cfg)
	await wait_screen("battle")
	b = Game.current
	b.bot = BotAI.new(0, 0.9, true)
	b.speed = 8.0
	t0 = Time.get_ticks_msec()
	while Game.screen_name == "battle" and Time.get_ticks_msec() - t0 < 180000:
		if b.sim.state == "offer" and b.offer_layer != null:
			b.sim.choose_offer(0); b._close_offer()
		await frames(2)
	await wait_screen("results", 20000)
	check(Game.screen_name == "results", "level 1-1 results (%s)" % Game.last_summary.get("result", "?"))
	check(Save.stat("kills") > 0 and Save.stat("merges") > 0, "stats recorded")
	check(Save.coins() > 250, "coins awarded")
	# --- save / load round-trip
	var coins := Save.coins()
	var kills := Save.stat("kills")
	Save.save()
	Save.load_game()
	check(Save.coins() == coins and Save.stat("kills") == kills, "save/load round trip")
	check(Save.data["profile"]["name"] == "Tester", "profile persisted")
	print("FLOW DONE failures=", failures)
	get_tree().quit(1 if failures > 0 else 0)
