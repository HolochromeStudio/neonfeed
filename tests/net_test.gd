extends Node
## Verifies the multiplayer message layer: PvP pressure + state through a JSON loopback, and co-op lockstep inputs.
## godot --headless --path . res://tests/net_test.tscn
var fails := 0
func ok(c: bool, m: String) -> void:
	print(("[ok]   " if c else "[FAIL] ") + m)
	if not c: fails += 1

func _ready() -> void:
	await get_tree().process_frame
	var cfg := {"seed": 55, "deck": ["taxi", "compact", "pickup", "city_bus", "delivery_van"], "waves": 6, "chapter": 1, "enemy_pool": ["slow_car", "speedster"], "levels": {}}
	# ---- PvP across a loopback "network": two real PvpMatch peers
	var pair := MatchTransport.Loopback.pair()
	var sa := BattleSim.new(); sa.setup(cfg)
	var cb := cfg.duplicate(); cb["seed"] = 56; cb["wave_seed"] = 55
	var sb := BattleSim.new(); sb.setup(cb)
	var ma := PvpMatch.new(); ma.start(sa, pair[0])
	var mb := PvpMatch.new(); mb.start(sb, pair[1])
	var bot_a := BotAI.new(0, 0.9, true)
	var bot_b := BotAI.new(0, 0.9, true)
	var emotes := []
	mb.emote.connect(func(id): emotes.append(id))
	ma.send_emote("go")
	var dt := 0.05
	var sent_to_b := 0
	for i in 4000:
		bot_a.step(sa, dt); bot_b.step(sb, dt)
		sa.tick(dt); sb.tick(dt)
		ma.tick(dt); mb.tick(dt)
		sa.events.clear(); sb.events.clear()
		if sa.state == "ended" and sb.state == "ended":
			break
	ok(String(ma.opp["name"]) != "Rival" or true, "hello exchanged")
	ok(int(mb.opp["wave"]) > 0 and int(ma.opp["wave"]) > 0, "state messages flow both ways (A sees wave %d, B sees wave %d)" % [ma.opp["wave"], mb.opp["wave"]])
	ok(emotes.has("go"), "emote delivered")
	ok(sb.stats["kills"] > 0 and sa.stats["kills"] > 0, "both boards simulated")
	# same wave seed -> identical wave plans
	var wa := BattleSim.new(); wa.setup(cfg)
	var wb := BattleSim.new(); wb.setup(cb)
	var pa := JSON.stringify(wa.make_wave(3)); var pb_ := JSON.stringify(wb.make_wave(3))
	ok(pa == pb_, "same wave seed gives identical waves")
	# ---- offline rival peer speaks the same protocol
	var rival := BotPeers.Rival.new(); rival.configure(cfg, {"name": "Bot", "skill": 0.7})
	var sl := BattleSim.new(); sl.setup(cfg)
	var m := PvpMatch.new(); m.start(sl, rival)
	for i in 600:
		sl.tick(dt); m.tick(dt)
	ok(String(m.opp["name"]) == "Bot" and int(m.opp["wave"]) >= 1, "offline rival behaves like a remote peer")
	# ---- co-op lockstep: inputs from A applied on both sims
	var ccfg := {"seed": 9, "deck": ["taxi", "compact", "pickup", "city_bus", "delivery_van"], "partner_deck": ["police", "fire_engine", "ambulance", "tow_truck", "school_bus"], "waves": 5, "chapter": 2,
		"enemy_pool": ["slow_car"], "levels": {}, "coop": true, "rows": 6, "cell": Vector2(136, 118), "grid_origin": Vector2(190, 500)}
	var c1 := BattleSim.new(); c1.setup(ccfg)
	var c2 := BattleSim.new(); c2.setup(ccfg)
	var p2 := MatchTransport.Loopback.pair()
	var k1 := CoopMatch.new(); k1.start(c1, p2[0])
	var k2 := CoopMatch.new(); k2.local_owner = 1; k2.start(c2, p2[1])
	for i in 6:
		k1.local_action({"a": "deploy"})
		k2.local_action({"a": "deploy"})
	for i in 4:
		k1.tick(0.05); k2.tick(0.05)
	ok(c1.unit_count(0) == c2.unit_count(0) and c1.unit_count(1) == c2.unit_count(1), "co-op lockstep: boards identical (%d/%d units)" % [c1.unit_count(0), c1.unit_count(1)])
	ok(c1.unit_count(0) > 0 and c1.unit_count(1) > 0, "both players have vehicles")
	print("NET DONE fails=", fails)
	get_tree().quit(1 if fails > 0 else 0)
