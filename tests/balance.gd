extends Node
## Batch balance harness. godot --headless --path . res://tests/balance.tscn -- [seeds] [skill]
func _ready() -> void:
	var args := OS.get_cmdline_user_args()
	var seeds := int(args[0]) if args.size() > 0 else 5
	var skill := float(args[1]) if args.size() > 1 else 0.8
	var order: Array = []
	for r in ["common", "uncommon", "rare", "epic", "legendary", "mythic"]:
		for u in Data.unit_list:
			if u["rarity"] == r:
				order.append(u["id"])
	var unlocked: Array = MetaData.STARTER_UNITS.duplicate()
	var oi := 0
	var rng := RandomNumberGenerator.new()
	rng.seed = 99
	var only_ch := int(args[2]) if args.size() > 2 else 0
	for ch in range(1, 10):
		for lv in range(1, 7):
			var L: Dictionary = Data.chapters[ch - 1]["levels"][lv - 1]
			var unlock_pool := unlocked.duplicate()
			if only_ch != 0 and ch != only_ch:
				if L["unlock"] != "" and not (L["unlock"] in unlocked):
					unlocked.append(L["unlock"])
				continue
			var wins := 0
			var waves := 0.0
			var tsum := 0.0
			for sd in seeds:
				var pool := unlock_pool.duplicate()
				pool.shuffle()
				var deck: Array = pool.slice(0, 5)
				var r: Dictionary = SimRun.run(ch, lv, 1000 + sd, deck, skill)
				if r["result"] == "victory":
					wins += 1
				waves += float(r["wave"]); tsum += float(r["time"])
			print("%d-%d waves=%d unlocked=%d win=%d/%d avg_wave=%.1f avg_time=%.0fs" % [ch, lv, L["waves"], unlock_pool.size(), wins, seeds, waves / seeds, tsum / seeds])
			if L["unlock"] != "" and not (L["unlock"] in unlocked):
				unlocked.append(L["unlock"])
	get_tree().quit()
