extends Node
func _ready() -> void:
	var C: Dictionary = Data.chapters[0]
	var L: Dictionary = C["levels"][0]
	var sim := BattleSim.new()
	sim.setup({"seed": 1, "deck": ["taxi","compact","delivery_van","pickup","city_bus"], "waves": L["waves"], "boss": L["boss"], "chapter": 1, "difficulty": 1.0, "enemy_pool": C["pool"], "first_offer": 2})
	var bot := BotAI.new(0, 0.8, true)
	var n := 0
	var t0 := Time.get_ticks_usec()
	var worst := 0
	while sim.state != "ended" and n < 6000:
		var a := Time.get_ticks_usec()
		bot.step(sim, 1.0/30.0)
		sim.tick(1.0/30.0)
		sim.events.clear()
		worst = maxi(worst, Time.get_ticks_usec() - a)
		n += 1
	var tot := Time.get_ticks_usec() - t0
	print("ticks=", n, " total_ms=", tot / 1000, " avg_us=", tot / n, " worst_us=", worst, " state=", sim.state, " en=", sim.enemies.size(), " u=", sim.units.size())
	get_tree().quit()
