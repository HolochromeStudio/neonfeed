class_name BotPeers
extends RefCounted
## Offline stand-ins for remote players. They implement MatchTransport, so PvpMatch / CoopMatch cannot tell them from a socket.

## PvP: a simulated rival with its own board. Same wave seed as the player; trades "send" pressure.
class Rival extends MatchTransport:
	var sim: BattleSim
	var bot: BotAI
	var info: Dictionary
	var _state_t: float = 0.0
	var _emote_t: float = 6.0
	var _kills_sent: int = 0
	var rng := RandomNumberGenerator.new()

	func configure(cfg: Dictionary, opp: Dictionary) -> void:
		info = opp
		rng.randomize()
		var oc := cfg.duplicate()
		oc["deck"] = opp.get("deck", ["police", "taxi", "fire_engine", "tow_truck", "city_bus"])
		oc["seed"] = int(cfg["seed"]) + 77
		oc["wave_seed"] = int(cfg["seed"])
		oc["player_sim"] = false
		sim = BattleSim.new()
		sim.setup(oc)
		bot = BotAI.new(0, float(opp.get("skill", 0.6)), true)
		sim.kill_hook = func(e: BattleSim.SimEnemy):
			if e.sent:
				return
			var n: int = int(sim.stats["kills"])
			if e.elite or e.boss:
				send({"t": "send", "enemy": "suv", "n": 2})
			elif n % 5 == 0:
				send({"t": "send", "enemy": "slow_car", "n": 1})

	func open() -> void:
		inbox.append({"t": "hello", "name": info.get("name", "Rival"), "rating": 1000})
		connected.emit()

	## Messages FROM the local player TO the rival.
	var _from_local: Array = []
	func send(msg: Dictionary) -> void:
		_from_local.append(msg)

	func _emit_to_local(msg: Dictionary) -> void:
		inbox.append(msg)

	func tick(dt: float) -> void:
		for m in _from_local:
			match m["t"]:
				"send":
					sim.inject_enemy(m["enemy"], int(m["n"]))
				"emote":
					if rng.randf() < 0.6:
						_emit_to_local({"t": "emote", "id": ["thanks", "oops", "go"][rng.randi() % 3]})
		_from_local.clear()
		var remaining := dt
		while remaining > 0.0 and sim.state != "ended":
			var step := minf(remaining, 0.05)
			remaining -= step
			bot.step(sim, step)
			sim.tick(step)
			sim.events.clear()
		_state_t -= dt
		if _state_t <= 0.0:
			_state_t = 0.25
			var lead := 0.0
			var alive := 0
			for e in sim.enemies:
				if e.alive:
					alive += 1
					lead = maxf(lead, e.progress / sim.path_len)
			_emit_to_local({"t": "state", "wave": sim.wave, "hp": sim.city_hp, "units": sim.units.size(), "enemies": alive, "lead": lead, "kills": sim.stats["kills"]})
		_emote_t -= dt
		if _emote_t <= 0.0:
			_emote_t = rng.randf_range(10, 25)
			if rng.randf() < 0.5:
				_emit_to_local({"t": "emote", "id": ["go", "oops", "on_my_way"][rng.randi() % 3]})
		if sim.state == "ended":
			_emit_to_local({"t": "end", "result": sim.result})

## Co-op: a simulated partner producing lockstep `input` messages for the shared board (owner 1).
class Partner extends MatchTransport:
	var bot: BotAI
	var name: String = "Partner"
	var shared_sim: BattleSim
	var _emote_t: float = 8.0
	var rng := RandomNumberGenerator.new()

	func configure(sim: BattleSim, nm: String) -> void:
		shared_sim = sim
		name = nm
		bot = BotAI.new(1, 0.7, false)
		rng.randomize()

	func open() -> void:
		inbox.append({"t": "hello", "name": name})
		connected.emit()

	func send(msg: Dictionary) -> void:
		if msg["t"] == "emote" and rng.randf() < 0.8:
			inbox.append({"t": "emote", "id": ["thanks", "go", "on_my_way"][rng.randi() % 3]})

	func tick(dt: float) -> void:
		for a in bot.decide(shared_sim, dt):
			inbox.append({"t": "input", "owner": 1, "a": a})
		_emote_t -= dt
		if _emote_t <= 0.0:
			_emote_t = rng.randf_range(14, 30)
			inbox.append({"t": "emote", "id": ["go", "on_my_way", "thanks"][rng.randi() % 3]})
