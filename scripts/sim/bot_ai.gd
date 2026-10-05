class_name BotAI
extends RefCounted
## Simple board-management bot. Used for: offline PvP opponent, co-op partner, balance tests (headless play-throughs).
var owner: int = 0
var skill: float = 0.8          # 0..1 -> reaction speed + merge quality
var controls_offers: bool = false
var t: float = 0.5
var merge_bias: float = 0.7

func _init(own: int = 0, sk: float = 0.8, offers: bool = false) -> void:
	owner = own; skill = sk; controls_offers = offers

func step(sim: BattleSim, dt: float) -> void:
	if sim.state == "offer":
		if controls_offers:
			_pick_offer(sim)
		return
	t -= dt
	if t > 0.0:
		return
	t = lerpf(1.1, 0.25, skill)
	# merges first
	var pairs := sim.mergeable_pairs(owner)
	if not pairs.is_empty():
		var board_fill := float(sim.unit_count(owner)) / float(maxi(1, sim.slots.size() / (2 if sim.coop else 1)))
		var pair: Array = pairs[0]
		var lowest := 99
		for p in pairs:
			if p[0].rank < lowest:
				lowest = p[0].rank; pair = p
		if lowest <= 2 or board_fill > 0.6 or sim.rng.randf() < merge_bias:
			sim.merge(pair[0], pair[1])
			return
	if sim.can_deploy(owner):
		var sp_have := sim.sp if owner == 0 else sim.sp_partner
		if sp_have >= sim.deploy_cost(owner) + (0 if sim.unit_count(owner) < 8 else 5):
			sim.deploy(owner)
			return
	if sim.state == "countdown" and sim.wave_timer > 2.0 and owner == 0 and skill > 0.6 and not sim.empty_slots(owner).is_empty() == false:
		sim.call_next_wave()

func _pick_offer(sim: BattleSim) -> void:
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
	sim.choose_offer(best)
