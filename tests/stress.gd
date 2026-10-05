extends Node
## Runs every vehicle, upgrade and relic through the simulator headlessly to catch runtime errors.
## godot --headless --path . res://tests/stress.tscn
func _ready() -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 2024
	var bad := 0
	var ids: Array = Data.units.keys()
	# 1) each unit as the star of a deck
	for id in ids:
		var deck: Array = [id]
		while deck.size() < 5:
			var o: String = ids[rng.randi() % ids.size()]
			if not (o in deck):
				deck.append(o)
		var sim := _make(deck, rng.randi(), 5)
		for k in 2:
			var up: Dictionary = Data.upgrades[rng.randi() % Data.upgrades.size()]
			sim.take_upgrade(up["id"])
		_run(sim, 70.0)
		if sim.stats["deploys"] == 0:
			push_error("unit %s never deployed" % id); bad += 1
	# 2) every upgrade applied alone to a strong deck
	for up in Data.upgrades:
		var sim := _make(["taxi", "police", "fire_engine", "tow_truck", "city_bus"], rng.randi(), 4)
		sim.take_upgrade(up["id"])
		_run(sim, 40.0)
	# 3) every relic
	for r in Data.relics:
		var sim := _make(["quantum_taxi", "ufo", "monster_truck", "ambulance", "limousine"], rng.randi(), 4)
		sim._add_relic(r["id"])
		_run(sim, 40.0)
	# 4) boss fights
	for b in Data.bosses:
		var sim := _make(["mini_tank", "crane_truck", "heavy_wrecker", "swat_van", "police"], rng.randi(), 6)
		sim.cfg["boss"] = b
		sim.total_waves = 3
		sim.wave = 2
		sim.state = "countdown"; sim.wave_timer = 0.0
		sim.cfg["boss"] = b
		_run(sim, 150.0)
		print("boss ", b, " bosses_seen=", sim.stats["bosses"], " result=", sim.result)
	print("STRESS DONE bad=", bad)
	get_tree().quit(1 if bad > 0 else 0)

func _make(deck: Array, seed_: int, chapter: int) -> BattleSim:
	var C: Dictionary = Data.chapters[chapter - 1]
	var sim := BattleSim.new()
	sim.setup({"seed": seed_, "deck": deck, "waves": 4, "boss": "", "chapter": chapter, "difficulty": 1.0, "enemy_pool": C["pool"], "biome": C["biome"], "first_offer": 2, "start_sp": 400, "city_hp": 60})
	return sim

func _run(sim: BattleSim, seconds: float) -> void:
	var bot := BotAI.new(0, 1.0, true)
	var dt := 1.0 / 30.0
	while sim.state != "ended" and sim.time < seconds:
		bot.step(sim, dt)
		sim.tick(dt)
		sim.events.clear()
