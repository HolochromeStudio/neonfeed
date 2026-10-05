class_name PvpMatch
extends RefCounted
## Real-time PvP adapter: both players simulate their own board from the same wave seed and exchange pressure ("send")
## and state messages through a MatchTransport. Offline play uses BotPeers.Rival as the transport; online uses a socket.

signal emote(id: String)
signal sent_pressure(enemy: String, n: int)
var sim: BattleSim
var transport: MatchTransport
var opp: Dictionary = {"name": "Rival", "hp": 20, "wave": 0, "units": 0, "enemies": 0, "lead": 0.0, "kills": 0}
var opp_result: String = ""
var _state_t: float = 0.0
var _sent_end: bool = false

func start(local: BattleSim, tr: MatchTransport) -> void:
	sim = local
	transport = tr
	sim.kill_hook = func(e: BattleSim.SimEnemy):
		if e.sent:
			return
		var n: int = int(sim.stats["kills"])
		if e.elite or e.boss:
			transport.send({"t": "send", "enemy": "suv", "n": 2}); sent_pressure.emit("suv", 2)
		elif n % 5 == 0:
			transport.send({"t": "send", "enemy": "slow_car", "n": 1}); sent_pressure.emit("slow_car", 1)
	transport.open()
	transport.send({"t": "hello", "name": Save.data["profile"]["name"], "rating": Save.data["pvp"]["rating"]})

func tick(dt: float) -> void:
	transport.tick(dt)
	_state_t -= dt
	if _state_t <= 0.0:
		_state_t = 0.25
		var lead := 0.0
		var alive := 0
		for e in sim.enemies:
			if e.alive:
				alive += 1
				lead = maxf(lead, e.progress / sim.path_len)
		transport.send({"t": "state", "wave": sim.wave, "hp": sim.city_hp, "units": sim.units.size(), "enemies": alive, "lead": lead, "kills": sim.stats["kills"]})
	if sim.state == "ended" and not _sent_end:
		_sent_end = true
		transport.send({"t": "end", "result": sim.result})
	for m in transport.poll():
		match m.get("t", ""):
			"hello":
				opp["name"] = m.get("name", "Rival")
			"state":
				for k in ["wave", "hp", "units", "enemies", "lead", "kills"]:
					opp[k] = m.get(k, opp[k])
			"send":
				sim.inject_enemy(String(m["enemy"]), int(m["n"]))
			"emote":
				emote.emit(String(m["id"]))
			"end":
				opp_result = String(m.get("result", ""))
	if int(opp["hp"]) <= 0 and sim.state != "ended":
		sim._finish("victory")

func send_emote(id: String) -> void:
	transport.send({"t": "emote", "id": id})

## victory if the rival's city falls first, or both finish and we have more HP.
func final_result() -> String:
	if int(opp["hp"]) <= 0:
		return "victory"
	if sim.result == "defeat":
		return "defeat"
	return "victory" if sim.city_hp >= int(opp["hp"]) else "defeat"
