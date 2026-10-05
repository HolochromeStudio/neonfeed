class_name SimRun
extends Node
## Headless balance / smoke test:
##   godot --headless --path . res://tests/sim_run.tscn -- [chapter] [level] [seed] [skill]
func _ready() -> void:
	var args := OS.get_cmdline_user_args()
	var ch := int(args[0]) if args.size() > 0 else 1
	var lv := int(args[1]) if args.size() > 1 else 1
	var seed_ := int(args[2]) if args.size() > 2 else 1
	var skill := float(args[3]) if args.size() > 3 else 0.8
	var res := run(ch, lv, seed_, ["taxi", "compact", "delivery_van", "pickup", "city_bus"], skill)
	print(JSON.stringify(res))
	get_tree().quit()

static func run(ch: int, lv: int, seed_: int, deck: Array, skill: float, max_time: float = 1500.0) -> Dictionary:
	var C: Dictionary = Data.chapters[ch - 1]
	var L: Dictionary = C["levels"][lv - 1]
	var sim := BattleSim.new()
	sim.setup({"seed": seed_, "deck": deck, "waves": L["waves"], "boss": L["boss"], "chapter": ch, "difficulty": L["difficulty"], "enemy_pool": C["pool"], "biome": C["biome"], "first_offer": 2})
	var bot := BotAI.new(0, skill, true)
	var dt := 1.0 / 30.0
	while sim.state != "ended" and sim.time < max_time:
		bot.step(sim, dt)
		sim.tick(dt)
		sim.events.clear()
	var s := sim.summary()
	s["deck"] = deck
	return s
