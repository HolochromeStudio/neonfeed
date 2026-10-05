class_name CoopMatch
extends RefCounted
## Co-op adapter: one shared deterministic battle. Each peer sends its own inputs as {t:"input", a:{...}}; both apply
## every input (local ones immediately, remote ones on arrival) -> lockstep-style. Offline: BotPeers.Partner.

signal emote(id: String)
var sim: BattleSim
var transport: MatchTransport
var partner_name: String = "Partner"
var local_owner: int = 0   # host = 0 (bottom rows), guest = 1 (top rows)

func start(shared: BattleSim, tr: MatchTransport) -> void:
	sim = shared
	transport = tr
	transport.open()

## Local player's action: apply + broadcast.
func local_action(a: Dictionary) -> bool:
	var ok := sim.apply_action(local_owner, a)
	if ok:
		transport.send({"t": "input", "owner": local_owner, "a": a})
	return ok

func tick(dt: float) -> void:
	transport.tick(dt)
	for m in transport.poll():
		match m.get("t", ""):
			"hello":
				partner_name = m.get("name", "Partner")
			"input":
				sim.apply_action(int(m.get("owner", 1 - local_owner)), m["a"])
			"emote":
				emote.emit(String(m["id"]))

func send_emote(id: String) -> void:
	transport.send({"t": "emote", "id": id})
