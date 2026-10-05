class_name MetaData
## Campaign structure, quests, achievements and cosmetics.

const STARTER_DECK := ["taxi", "compact", "delivery_van", "pickup", "city_bus"]
const STARTER_UNITS := ["taxi", "compact", "delivery_van", "pickup", "city_bus"]

static func _unlock_order() -> Array:
	var out: Array = []
	for r in ["common", "uncommon", "rare", "epic", "legendary", "mythic"]:
		for u in UnitsData.build():
			if u["rarity"] == r and not (u["id"] in STARTER_UNITS):
				out.append(u["id"])
	return out

## 9 chapters x 6 levels. Level 6 is the chapter boss. Unlock order walks the roster by rarity (54 of the 55 non-starter units;
## the last one, "mini_tank"... see achievements) so power and rarity track progress.
static func chapters() -> Array:
	var order := _unlock_order()
	var defs := [
		{"name": "City Center", "biome": "city_center", "boss": "monster_truck", "pool": ["slow_car", "speedster", "suv", "truck"], "sub": "Rush Hour Rebellion"},
		{"name": "Suburbs", "biome": "suburbs", "boss": "helicopter", "pool": ["slow_car", "speedster", "suv", "truck", "bus", "gang_cars"], "sub": "Cul-de-Sac Chaos"},
		{"name": "Highway", "biome": "highway", "boss": "tank", "pool": ["speedster", "suv", "truck", "bus", "gang_cars", "police_chase", "motorcycle"], "sub": "Fast Lane Fury"},
		{"name": "Industrial", "biome": "industrial", "boss": "drill_truck", "pool": ["suv", "truck", "bus", "gang_cars", "police_chase", "armored_truck", "road_cleaner"], "sub": "Shipping Gridlock"},
		{"name": "Desert", "biome": "desert", "boss": "ufo", "pool": ["slow_car", "speedster", "suv", "truck", "motorcycle", "road_cleaner", "gang_cars"], "sub": "Mirage Traffic"},
		{"name": "Snow Town", "biome": "snow_town", "boss": "mecha", "pool": ["suv", "truck", "bus", "police_chase", "armored_truck", "road_cleaner"], "sub": "Whiteout Jam"},
		{"name": "Beach Road", "biome": "beach_road", "boss": "monster_truck", "pool": ["speedster", "suv", "gang_cars", "motorcycle", "police_chase", "armored_truck"], "sub": "Summer Gridlock"},
		{"name": "Countryside", "biome": "countryside", "boss": "drill_truck", "pool": ["slow_car", "truck", "bus", "armored_truck", "road_cleaner", "police_chase", "suv"], "sub": "Harvest Highway"},
		{"name": "Night City", "biome": "night_city", "boss": "mecha", "pool": ["speedster", "suv", "truck", "bus", "gang_cars", "police_chase", "motorcycle", "armored_truck", "road_cleaner"], "sub": "The Final Jam"},
	]
	var out: Array = []
	var oi := 0
	for ci in defs.size():
		var d: Dictionary = defs[ci]
		var levels: Array = []
		for li in 6:
			var waves := 8 + li * 2 if li < 5 else 14
			var boss := li == 5
			var unlock := ""
			if oi < order.size():
				unlock = order[oi]; oi += 1
			levels.append({
				"id": "%d-%d" % [ci + 1, li + 1], "chapter": ci + 1, "level": li + 1, "waves": waves, "boss": d["boss"] if boss else "",
				"difficulty": 1.0 + 0.06 * li + (0.18 if boss else 0.0), "unlock": unlock,
				"coins": 60 + 22 * li + 35 * ci, "xp": 30 + 10 * li + 6 * ci, "cards": 2 + li,
				"name": ("BOSS: " if boss else "") + "%s %d" % [d["name"], li + 1],
			})
		out.append({"id": ci + 1, "name": d["name"], "sub": d["sub"], "biome": d["biome"], "boss": d["boss"], "pool": d["pool"], "levels": levels,
			"req_level": ci * 2, "difficulty": 1.0})
	return out

static func quests_daily() -> Array:
	return [
		{"id": "d_kills", "name": "Traffic Control", "desc": "Defeat {n} enemies", "stat": "kills", "n": [60, 100, 150], "coins": 80, "gems": 0},
		{"id": "d_merges", "name": "Merge Master", "desc": "Perform {n} merges", "stat": "merges", "n": [8, 12, 20], "coins": 90, "gems": 0},
		{"id": "d_deploys", "name": "Fleet Manager", "desc": "Deploy {n} vehicles", "stat": "deploys", "n": [15, 25, 40], "coins": 70, "gems": 0},
		{"id": "d_waves", "name": "Keep Driving", "desc": "Survive {n} waves", "stat": "waves", "n": [10, 16, 24], "coins": 100, "gems": 1},
		{"id": "d_wins", "name": "Clean Sweep", "desc": "Win {n} runs", "stat": "wins", "n": [1, 2, 3], "coins": 120, "gems": 2},
		{"id": "d_elites", "name": "Elite Hunter", "desc": "Defeat {n} elite enemies", "stat": "elites", "n": [2, 4, 6], "coins": 110, "gems": 1},
		{"id": "d_upgrades", "name": "Tune-Up", "desc": "Take {n} run upgrades", "stat": "upgrades", "n": [4, 6, 10], "coins": 80, "gems": 0},
		{"id": "d_rank5", "name": "High Roller", "desc": "Reach merge rank 5", "stat": "rank5", "n": [1, 1, 1], "coins": 130, "gems": 1},
		{"id": "d_bosses", "name": "Boss Fight", "desc": "Defeat {n} boss", "stat": "bosses", "n": [1, 1, 2], "coins": 140, "gems": 2},
		{"id": "d_survival", "name": "Endurance", "desc": "Reach wave {n} in Survival", "stat": "survival_best", "n": [8, 12, 16], "coins": 120, "gems": 1},
		{"id": "d_crits", "name": "Critical Thinking", "desc": "Land {n} critical hits", "stat": "crits", "n": [40, 80, 150], "coins": 80, "gems": 0},
		{"id": "d_pvp", "name": "Friendly Rivalry", "desc": "Play {n} PvP match", "stat": "pvp_played", "n": [1, 2, 3], "coins": 100, "gems": 1},
	]

static func quests_weekly() -> Array:
	return [
		{"id": "w_kills", "name": "Road Warrior", "desc": "Defeat {n} enemies", "stat": "kills", "n": [600, 900], "coins": 400, "gems": 8},
		{"id": "w_merges", "name": "Merge Marathon", "desc": "Perform {n} merges", "stat": "merges", "n": [80, 120], "coins": 400, "gems": 8},
		{"id": "w_wins", "name": "Winning Streak", "desc": "Win {n} runs", "stat": "wins", "n": [6, 10], "coins": 500, "gems": 10},
		{"id": "w_bosses", "name": "Boss Rush", "desc": "Defeat {n} bosses", "stat": "bosses", "n": [5, 8], "coins": 450, "gems": 10},
		{"id": "w_coop", "name": "Team Player", "desc": "Play {n} Co-op matches", "stat": "coop_played", "n": [3, 5], "coins": 400, "gems": 8},
	]

static func achievements() -> Array:
	var a: Array = []
	var add := func(id: String, name: String, desc: String, stat: String, n: int, coins: int, gems: int, reward_unit: String = "", reward_cos: String = ""):
		a.append({"id": id, "name": name, "desc": desc, "stat": stat, "n": n, "coins": coins, "gems": gems, "unit": reward_unit, "cos": reward_cos})
	add.call("first_blood", "First Fender-Bender", "Defeat 1 enemy.", "kills", 1, 20, 0)
	add.call("kills_100", "Road Rage", "Defeat 100 enemies.", "kills", 100, 100, 1)
	add.call("kills_1000", "Traffic Terminator", "Defeat 1,000 enemies.", "kills", 1000, 300, 3)
	add.call("kills_10000", "Jam Annihilator", "Defeat 10,000 enemies.", "kills", 10000, 1000, 10, "", "hat_crown")
	add.call("merge_1", "Two Become One", "Perform your first merge.", "merges", 1, 20, 0)
	add.call("merge_50", "Merge Apprentice", "Perform 50 merges.", "merges", 50, 120, 1)
	add.call("merge_500", "Merge Master", "Perform 500 merges.", "merges", 500, 400, 4)
	add.call("rank_5", "High Rank", "Reach merge rank 5 in a run.", "max_rank", 5, 120, 1)
	add.call("rank_7", "Maximum Overdrive", "Reach merge rank 7 in a run.", "max_rank", 7, 400, 4)
	add.call("deploy_100", "Fleet Builder", "Deploy 100 vehicles.", "deploys", 100, 100, 1)
	add.call("deploy_1000", "Car Dealership", "Deploy 1,000 vehicles.", "deploys", 1000, 400, 4)
	add.call("win_1", "Traffic Cleared", "Win a campaign level.", "wins", 1, 60, 1)
	add.call("win_10", "Seasoned Dispatcher", "Win 10 runs.", "wins", 10, 200, 2)
	add.call("win_50", "Chief of Traffic", "Win 50 runs.", "wins", 50, 600, 6)
	add.call("boss_1", "Giant Slayer", "Defeat a boss.", "bosses", 1, 100, 2)
	add.call("boss_10", "Boss Breaker", "Defeat 10 bosses.", "bosses", 10, 300, 4)
	add.call("boss_30", "Boss Rush", "Defeat 30 bosses.", "bosses", 30, 800, 8)
	add.call("ch_1", "City Saved", "Clear Chapter 1.", "chapters_cleared", 1, 150, 2)
	add.call("ch_3", "Highway Hero", "Clear 3 chapters.", "chapters_cleared", 3, 300, 3)
	add.call("ch_5", "Halfway There", "Clear 5 chapters.", "chapters_cleared", 5, 500, 5)
	add.call("ch_9", "Road Master", "Clear all 9 chapters.", "chapters_cleared", 9, 2000, 20, "mini_tank", "hat_golden")
	add.call("survival_10", "Survivor", "Reach wave 10 in Survival.", "survival_best", 10, 150, 2)
	add.call("survival_20", "Survival Expert", "Reach wave 20 in Survival.", "survival_best", 20, 400, 4)
	add.call("survival_30", "Unstoppable", "Reach wave 30 in Survival.", "survival_best", 30, 900, 9, "", "acc_trophy")
	add.call("pvp_1", "Friendly Rivalry", "Finish a PvP match.", "pvp_played", 1, 60, 1)
	add.call("pvp_win_5", "Duelist", "Win 5 PvP matches.", "pvp_wins", 5, 250, 3)
	add.call("pvp_win_25", "Arena Champion", "Win 25 PvP matches.", "pvp_wins", 25, 800, 8)
	add.call("coop_1", "Better Together", "Finish a Co-op match.", "coop_played", 1, 60, 1)
	add.call("coop_win_10", "Dream Team", "Win 10 Co-op matches.", "coop_wins", 10, 400, 4)
	add.call("upgrade_50", "Tinkerer", "Take 50 run upgrades.", "upgrades", 50, 150, 2)
	add.call("upgrade_500", "Mad Scientist", "Take 500 run upgrades.", "upgrades", 500, 600, 6)
	add.call("relic_10", "Relic Hunter", "Collect 10 relics.", "relics", 10, 200, 2)
	add.call("relic_100", "Relic Hoarder", "Collect 100 relics.", "relics", 100, 800, 8)
	add.call("crit_500", "Critical Mass", "Land 500 critical hits.", "crits", 500, 200, 2)
	add.call("units_20", "Collector", "Own 20 vehicles.", "units_owned", 20, 300, 3)
	add.call("units_40", "Hoarder", "Own 40 vehicles.", "units_owned", 40, 700, 7)
	add.call("units_60", "Complete Garage", "Own all 60 vehicles.", "units_owned", 60, 3000, 30, "", "top_gold")
	add.call("level_10", "Rising Star", "Reach account level 10.", "player_level", 10, 300, 3)
	add.call("level_25", "Veteran", "Reach account level 25.", "player_level", 25, 900, 9)
	add.call("perfect", "Flawless Run", "Win a level without the city losing HP.", "perfect_wins", 1, 250, 3)
	add.call("synergy_5", "Chemistry", "Activate 5 different synergies in one run.", "max_synergies", 5, 250, 3)
	add.call("customize", "Fresh Look", "Change your character's look.", "customized", 1, 40, 0)
	add.call("tutorial", "Driver's Ed", "Complete the tutorial.", "tutorial_done", 1, 50, 1)
	add.call("daily_7", "Regular", "Claim 7 daily rewards.", "daily_claims", 7, 200, 2)
	return a

static func _cos(id: String, cat: String, name: String, price: int, unlock: String, key: String, color: Color = Color.WHITE) -> Dictionary:
	return {"id": id, "cat": cat, "name": name, "price": price, "unlock": unlock, "key": key, "color": color}

## unlock: "" free | "lvl:N" | "shop" (price coins) | "ach:<id>"
static func cosmetics() -> Array:
	var a: Array = []
	for i in 6:
		var sk := [Color("f1c9a5"), Color("e0a97a"), Color("c68a5a"), Color("a56a3e"), Color("7a4a2c"), Color("5a3320")]
		a.append(_cos("skin_%d" % i, "skin", ["Peach", "Sand", "Tan", "Bronze", "Brown", "Cocoa"][i], 0, "", "", sk[i]))
	a.append(_cos("hair_none", "hair", "No Hair", 0, "", ""))
	a.append(_cos("hair_messy_brown", "hair", "Messy Brown", 0, "", "cos_hair_messy_brown"))
	a.append(_cos("hair_spiky_black", "hair", "Spiky Black", 0, "", "cos_hair_spiky_black"))
	a.append(_cos("hair_slick_black", "hair", "Slick Black", 150, "shop", "cos_hair_slick_black"))
	a.append(_cos("hair_curly_blond", "hair", "Curly Blond", 200, "lvl:3", "cos_hair_curly_blond"))
	a.append(_cos("hat_none", "hat", "No Hat", 0, "", ""))
	a.append(_cos("hat_cap_blue_red", "hat", "Rookie Cap", 0, "", "cos_hats_cap_blue_red"))
	a.append(_cos("hat_cap_red_blue", "hat", "Dispatch Cap", 0, "", "cos_hats_cap_red_blue"))
	a.append(_cos("hat_cap_green", "hat", "Green Visor", 120, "shop", "cos_hats_cap_green"))
	a.append(_cos("hat_cap_white", "hat", "Crew Cap", 120, "lvl:2", "cos_hats_cap_white"))
	a.append(_cos("hat_black", "hat", "Black Brim", 250, "shop", "cos_hats_hat_black"))
	a.append(_cos("glasses_none", "glasses", "No Glasses", 0, "", ""))
	a.append(_cos("glasses_round", "glasses", "Round Shades", 100, "shop", "cos_glasses_round_shades"))
	a.append(_cos("glasses_dark", "glasses", "Dark Shades", 180, "lvl:4", "cos_glasses_dark_shades"))
	a.append(_cos("acc_none", "accessory", "Nothing", 0, "", ""))
	a.append(_cos("acc_headphones", "accessory", "Headphones", 160, "shop", "cos_accessories_headphones"))
	a.append(_cos("acc_backpack", "accessory", "Backpack", 90, "", "doll_backpack"))
	a.append(_cos("acc_trophy", "accessory", "Survival Trophy", 0, "ach:survival_30", "icon_trophy"))
	var tops := [["Patchwork Blue", Color("5b79b0"), 0, ""], ["Navy Scarf", Color("3a4f82"), 0, ""], ["Hi-Vis Orange", Color("e0873a"), 100, "shop"], ["Teal Hoodie", Color("3f9a94"), 120, "shop"],
		["Red Jacket", Color("c24a43"), 150, "lvl:3"], ["Green Jacket", Color("4f8a50"), 150, "shop"], ["Tan Coat", Color("c49a62"), 100, "lvl:2"], ["Grey Jacket", Color("8a8a88"), 80, "shop"],
		["Taxi Yellow", Color("e8b83a"), 200, "lvl:5"], ["Violet", Color("7d63b0"), 200, "shop"], ["Gold Suit", Color("e2b84a"), 0, "ach:ch_9"]]
	for i in tops.size():
		a.append(_cos("top_%d" % i, "top", tops[i][0], tops[i][2], tops[i][3] if tops[i][3] != "" else "", "", tops[i][1]))
	a[a.size() - 1]["unlock"] = "ach:ch_9"
	var bots := [["Denim", Color("3f5f8f"), 0, ""], ["Cargo Brown", Color("7a5a3a"), 0, ""], ["Charcoal", Color("45464a"), 90, "shop"], ["Khaki", Color("b3a070"), 90, "lvl:2"], ["Forest", Color("3f6a45"), 110, "shop"], ["Crimson", Color("9a3a3a"), 140, "shop"]]
	for i in bots.size():
		a.append(_cos("bot_%d" % i, "bottom", bots[i][0], bots[i][2], bots[i][3] if bots[i][3] != "" else "", "", bots[i][1]))
	var shoes := [["Dark Boots", Color("3a2e2a"), 0, ""], ["Red Sneakers", Color("c24a43"), 80, "shop"], ["White Kicks", Color("e8e4dc"), 80, "lvl:3"], ["Brown Boots", Color("7a5238"), 60, "shop"]]
	for i in shoes.size():
		a.append(_cos("shoe_%d" % i, "shoes", shoes[i][0], shoes[i][2], shoes[i][3] if shoes[i][3] != "" else "", "", shoes[i][1]))
	a.append(_cos("hat_crown", "hat", "Jam Crown", 0, "ach:kills_10000", "icon_crown"))
	a.append(_cos("hat_golden", "hat", "Golden Hard Hat", 0, "ach:ch_9", "cos_hats_cap_green"))
	a.append(_cos("top_gold", "top", "Collector's Coat", 0, "ach:units_60", "", Color("f0c850")))
	return a
