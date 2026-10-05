extends Node
## Rule-level tests of the simulator. godot --headless --path . res://tests/unit_test.tscn
var fails := 0
func ok(c: bool, m: String) -> void:
	print(("[ok]   " if c else "[FAIL] ") + m)
	if not c: fails += 1

func _sim(deck: Array, seed_: int = 1) -> BattleSim:
	var s := BattleSim.new()
	s.setup({"seed": seed_, "deck": deck, "waves": 10, "chapter": 1, "enemy_pool": ["slow_car"], "levels": {}, "start_sp": 500})
	return s

func _ready() -> void:
	await get_tree().process_frame
	# --- deploy
	var s := _sim(["taxi", "police", "fire_engine", "tow_truck", "city_bus"])
	var c0 := s.deploy_cost()
	var u := s.deploy()
	ok(u != null and s.units.size() == 1 and s.sp == 500 - c0, "deploy spawns a rank-1 vehicle and spends SP")
	ok(s.deploy_cost() > c0, "deploy cost rises")
	# --- merge rules
	var t := _sim(["taxi"])
	var a := t.deploy(); var b := t.deploy()
	ok(t.can_merge(a, b), "equal unit + rank can merge")
	var m := t.merge(a, b)
	ok(m != null and m.rank == 2 and t.units.size() == 1, "merge consumes both, creates rank 2")
	var c := t.deploy(); var d := t.deploy()
	ok(not t.can_merge(m, c) and t.can_merge(c, d), "different ranks cannot merge")
	var mixed := _sim(["taxi", "police", "fire_engine", "tow_truck", "city_bus"], 3)
	var results := {}
	for i in 40:
		mixed.units.clear(); mixed.slots.fill(null)
		var x := mixed._spawn_unit("taxi", 1, 0, 0); var y := mixed._spawn_unit("taxi", 1, 1, 0)
		var r := mixed.merge(x, y)
		results[r.uid] = true
	ok(results.size() >= 3, "merge result is random across the deck (%d different units)" % results.size())
	var top := _sim(["taxi"])
	var hi1 := top._spawn_unit("taxi", 7, 0, 0); var hi2 := top._spawn_unit("taxi", 7, 1, 0)
	ok(not top.can_merge(hi1, hi2), "rank 7 is the standard maximum")
	top.apply_ops([["rule", "rank8"]])
	ok(top.can_merge(hi1, hi2), "BEYOND SEVEN raises the cap")
	# --- determinism
	var h := []
	for run in 2:
		var q := _sim(["taxi", "police", "fire_engine", "tow_truck", "city_bus"], 99)
		var bot := BotAI.new(0, 0.9, true)
		for i in 1200:
			bot.step(q, 0.05); q.tick(0.05); q.events.clear()
		h.append("%d|%d|%d|%d|%d" % [q.stats["kills"], q.units.size(), int(q.sp), q.city_hp, q.wave])
	ok(h[0] == h[1], "same seed + same inputs -> identical outcome (%s)" % h[0])
	# --- synergies
	var sy := _sim(["taxi"])
	for i in 3:
		sy._spawn_unit("taxi", 1, i, 0)
	sy._recompute()
	ok(sy.synergy_active.any(func(x): return x["id"] == "taxi"), "3 Taxis activate TAXI RANK")
	var fr := _sim(["police"])
	fr._spawn_unit("police", 1, 0, 0); fr._spawn_unit("fire_engine", 1, 1, 0); fr._spawn_unit("ambulance", 1, 2, 0)
	fr._recompute()
	ok(fr.synergy_active.any(func(x): return x["id"] == "first_responders"), "Police+Fire+Ambulance activate FIRST RESPONDERS")
	# --- status interactions
	var st := _sim(["taxi"])
	var e := st._spawn_enemy("slow_car", false, false)
	st.apply_enemy_status(e, "burn", 3.0, 5.0)
	ok(e.st.has("burn"), "burn applies")
	st.apply_enemy_status(e, "wet", 3.0)
	ok(not e.st.has("burn") and e.st.has("wet"), "WET extinguishes BURN")
	st.apply_enemy_status(e, "burn", 3.0, 5.0)
	ok(not e.st.has("burn"), "cannot ignite a WET enemy")
	# --- rule changers
	var g := _sim(["taxi"])
	var e1 := g._spawn_enemy("slow_car", false, false)
	var base_speed := e1.speed
	g.apply_ops([["rule", "gridlock"]])
	var e2 := g._spawn_enemy("slow_car", false, false)
	ok(e2.speed < base_speed * 0.7, "GRIDLOCK heavily slows enemies")
	var pb := _sim(["taxi"])
	pb.apply_ops([["rule", "parking_ban"]])
	var pu := pb.deploy()
	ok(pu.rank == 2, "PARKING BAN spawns rank 2")
	# --- data integrity
	ok(Data.units.size() == 60, "60 vehicles")
	ok(Data.upgrades.size() >= 120, "120+ upgrades (%d)" % Data.upgrades.size())
	ok(Data.relics.size() >= 50, "50+ relics (%d)" % Data.relics.size())
	var cats := {}
	for up in Data.upgrades: cats[up["cat"]] = true
	ok(cats.size() >= 16, "16 upgrade categories (%d)" % cats.size())
	# --- offers are context aware
	var o := _sim(["police", "fire_engine", "ambulance", "swat_van", "highway_patrol"])
	var tot_em := 0
	for i in 40:
		for opt in o.roll_upgrade_offer():
			if opt["id"] in ["tag_emergency", "emergency_lane", "overtime", "sirens_song"]:
				tot_em += 1
	var o2 := _sim(["taxi", "compact", "hatchback", "scooter", "pickup"])
	var tot_em2 := 0
	for i in 40:
		for opt in o2.roll_upgrade_offer():
			if opt["id"] in ["tag_emergency", "emergency_lane", "overtime"]:
				tot_em2 += 1
	ok(tot_em > tot_em2, "emergency upgrades are offered more to an emergency deck (%d vs %d)" % [tot_em, tot_em2])
	# --- save slot round trip
	Save.PATH = "user://unit_test_save.json"
	Save.reset_all()
	Save.add_wallet("coins", 123)
	Save.save(); Save.load_game()
	ok(Save.coins() == 373, "save round trip")
	print("UNIT DONE fails=", fails)
	get_tree().quit(1 if fails > 0 else 0)
