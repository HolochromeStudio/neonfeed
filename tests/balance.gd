extends Node
## Batch balance harness (headless): simulates campaign progression with a mid-skill bot.
##   godot --headless --path . res://tests/balance.tscn -- [seeds] [skill] [only_chapter] [only_level]
## The bot owns the units unlocked so far, builds a sensible deck, and has unit levels that track normal card income.
func _ready() -> void:
	var args := OS.get_cmdline_user_args()
	var seeds := int(args[0]) if args.size() > 0 else 4
	var skill := float(args[1]) if args.size() > 1 else 0.8
	var only_ch := int(args[2]) if args.size() > 2 else 0
	var only_lv := int(args[3]) if args.size() > 3 else 0
	var unlocked: Array = MetaData.STARTER_UNITS.duplicate()
	for ch in range(1, 10):
		for lv in range(1, 7):
			var L: Dictionary = Data.chapters[ch - 1]["levels"][lv - 1]
			var pool := unlocked.duplicate()
			if (only_ch == 0 or ch == only_ch) and (only_lv == 0 or lv == only_lv):
				var deck := best_deck(pool)
				var level := clampi(1 + int((ch - 1) * 1.3 + lv / 3.0), 1, 10)
				var levels := {}
				for id in pool:
					levels[id] = level
				var wins := 0
				var waves := 0.0
				var tsum := 0.0
				for sd in seeds:
					var r := run_level(ch, lv, 7000 + sd, deck, levels, skill)
					if r["result"] == "victory":
						wins += 1
					waves += float(r["wave"]); tsum += float(r["time"])
				print("%d-%d waves=%2d owned=%2d lvl=%d win=%d/%d avg_wave=%.1f avg_t=%3.0fs deck=%s" % [ch, lv, L["waves"], pool.size(), level, wins, seeds, waves / seeds, tsum / seeds, ",".join(deck)])
			if L["unlock"] != "" and not (L["unlock"] in unlocked):
				unlocked.append(L["unlock"])
	get_tree().quit()

static func power(id: String) -> float:
	var u: Dictionary = Data.units[id]
	var dps := float(u["dmg"]) / float(u["interval"])
	var w := 0.5
	for r in u["roles"]:
		w = maxf(w, {"DAMAGE": 1.0, "AOE": 1.15, "BURST": 1.0, "CONTROL": 0.85, "DEBUFFER": 0.85, "BOSS KILLER": 0.9, "COMBO": 0.9, "SUPPORT": 0.5, "BUFFER": 0.55, "ECONOMY": 0.55, "SUMMONER": 0.6}.get(r, 0.6))
	var mult := 1.0
	for t in u["traits"]:
		match t["k"]:
			"splash": mult += 0.35 * float(t["pct"])
			"multi": mult += 0.3 * float(t["n"])
			"chain": mult += 0.2 * float(t["n"])
			"pierce": mult += 0.15 * float(t["n"])
			"aura_all": mult += 1.2
			"aura_row", "aura_col", "aura_adj", "aura_tag": mult += 0.4
			"heal_city", "gate": mult += 0.3
	return dps * w * mult * (1.0 + 0.1 * float(Data.RARITIES.find(u["rarity"])))

static func best_deck(pool: Array) -> Array:
	var sorted := pool.duplicate()
	sorted.sort_custom(func(a, b): return power(a) > power(b))
	return sorted.slice(0, 5)

static func run_level(ch: int, lv: int, seed_: int, deck: Array, levels: Dictionary, skill: float) -> Dictionary:
	var C: Dictionary = Data.chapters[ch - 1]
	var L: Dictionary = C["levels"][lv - 1]
	var sim := BattleSim.new()
	sim.setup({"seed": seed_, "deck": deck, "levels": levels, "waves": L["waves"], "boss": L["boss"], "chapter": ch, "difficulty": L["difficulty"], "enemy_pool": C["pool"], "biome": C["biome"], "first_offer": 2})
	var bot := BotAI.new(0, skill, true)
	var dt := 1.0 / 20.0
	while sim.state != "ended" and sim.time < 1200.0:
		bot.step(sim, dt)
		sim.tick(dt)
		sim.events.clear()
	return sim.summary()
