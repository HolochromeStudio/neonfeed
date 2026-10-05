class_name BotAI
extends RefCounted
## Board-management bot. Used for the offline PvP rival, the co-op partner and headless balance runs.
## `decide()` is read-only and returns input actions (same schema as BattleSim.apply_action) so the same bot can drive a
## local sim, a network peer, or a replay. `step()` = decide + apply (for tests).
var owner: int = 0
var skill: float = 0.8          # 0..1 -> reaction speed + merge quality
var controls_offers: bool = false
var t: float = 0.5
var merge_bias: float = 0.7

func _init(own: int = 0, sk: float = 0.8, offers: bool = false) -> void:
	owner = own; skill = sk; controls_offers = offers

func step(sim: BattleSim, dt: float) -> void:
	for a in decide(sim, dt):
		sim.apply_action(owner, a)

func decide(sim: BattleSim, dt: float) -> Array:
	var out: Array = []
	if sim.state == "offer":
		if controls_offers:
			out.append({"a": "choose", "i": _pick_offer(sim)})
		return out
	t -= dt
	if t > 0.0:
		return out
	t = lerpf(1.1, 0.25, skill)
	var pairs := sim.mergeable_pairs(owner)
	if not pairs.is_empty():
		var half := sim.slots.size() / (2 if sim.coop else 1)
		var board_fill := float(sim.unit_count(owner)) / float(maxi(1, half))
		var pair: Array = pairs[0]
		var lowest := 99
		for p in pairs:
			if p[0].rank < lowest:
				lowest = p[0].rank; pair = p
		if lowest <= 2 or board_fill > 0.6 or sim.rng.randf() < merge_bias:
			out.append({"a": "merge", "u1": pair[0].id, "u2": pair[1].id})
			return out
	if sim.can_deploy(owner):
		var sp_have := sim.sp if owner == 0 else sim.sp_partner
		if sp_have >= sim.deploy_cost(owner) + (0 if sim.unit_count(owner) < 8 else 5):
			out.append({"a": "deploy"})
	return out

func _pick_offer(sim: BattleSim) -> int:
	var best := 0
	var bs := -1.0
	for i in sim.offer.size():
		var o: Dictionary = sim.offer[i]
		var sc: float = sim.upgrade_weight(o) if sim.offer_kind == "upgrade" else 50.0 + float({"common": 0, "rare": 20, "epic": 40, "legendary": 60}.get(o["rarity"], 0))
		if sc <= 0.0:
			sc = 1.0
		sc *= sim.rng.randf_range(0.8, 1.2)
		if sc > bs:
			bs = sc; best = i
	return best
