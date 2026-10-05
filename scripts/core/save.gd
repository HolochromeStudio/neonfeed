extends Node
## Persistent profile. JSON at user://traffic_jam_save.json with a rolling .bak and atomic writes.

signal changed
signal leveled_up(new_level: int)
signal unlocked(kind: String, id: String)

const PATH := "user://traffic_jam_save.json"
const VERSION := 3

var data: Dictionary = {}
var _dirty: bool = false
var _save_timer: float = 0.0
var loaded_existing: bool = false

func _ready() -> void:
	load_game()

func _process(dt: float) -> void:
	if _dirty:
		_save_timer -= dt
		if _save_timer <= 0.0:
			save()

func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_CLOSE_REQUEST or what == NOTIFICATION_APPLICATION_PAUSED or what == NOTIFICATION_APPLICATION_FOCUS_OUT:
		save()

# ------------------------------------------------------------------ defaults
func _default() -> Dictionary:
	var units := {}
	for id in MetaData.STARTER_UNITS:
		units[id] = {"level": 1, "cards": 0, "new": false}
	return {
		"version": VERSION,
		"created": Time.get_unix_time_from_system(),
		"profile": {"name": "Dispatcher", "level": 1, "xp": 0,
			"look": {"preset": "", "skin": "skin_1", "hair": "hair_messy_brown", "hat": "hat_cap_blue_red", "glasses": "glasses_none", "accessory": "acc_none", "top": "top_0", "bottom": "bot_0", "shoes": "shoe_0"}},
		"wallet": {"coins": 250, "gems": 10, "tickets": 3},
		"units": units,
		"decks": [MetaData.STARTER_DECK.duplicate(), [], []],
		"active_deck": 0,
		"cosmetics": ["skin_0", "skin_1", "skin_2", "skin_3", "skin_4", "skin_5", "hair_none", "hair_messy_brown", "hair_spiky_black", "hat_none", "hat_cap_blue_red", "hat_cap_red_blue",
			"glasses_none", "acc_none", "acc_backpack", "top_0", "top_1", "bot_0", "bot_1", "shoe_0"],
		"campaign": {"cleared": {}, "chapter_cleared": {}},
		"survival": {"best_wave": 0, "best_time": 0.0, "runs": 0},
		"pvp": {"rating": 1000, "wins": 0, "losses": 0, "streak": 0},
		"coop": {"wins": 0, "losses": 0},
		"stats": {},
		"achievements": {},
		"quests": {"daily_date": "", "daily": [], "weekly_week": "", "weekly": []},
		"daily_reward": {"last": "", "streak": 0},
		"inventory": {"rush_ticket": 1, "spare_tire": 1, "lucky_dice": 0},
		"relics_seen": [],
		"settings": {"music": 0.7, "sfx": 0.9, "haptics": true, "screen_shake": true, "quality": "high", "show_dmg": true, "speed": 1, "reduce_motion": false, "colorblind": false},
		"flags": {"intro_seen": false, "tutorial_done": false, "created_character": false, "tips": {}},
	}

func load_game() -> void:
	data = _default()
	for p in [PATH, PATH + ".bak"]:
		if FileAccess.file_exists(p):
			var f := FileAccess.open(p, FileAccess.READ)
			var txt := f.get_as_text()
			f.close()
			var j: Variant = JSON.parse_string(txt)
			if typeof(j) == TYPE_DICTIONARY:
				_merge(data, j)
				loaded_existing = true
				_migrate()
				return
	loaded_existing = false

func _merge(base: Dictionary, over: Dictionary) -> void:
	for k in over:
		if base.has(k) and typeof(base[k]) == TYPE_DICTIONARY and typeof(over[k]) == TYPE_DICTIONARY and k not in ["units", "cleared", "chapter_cleared", "stats", "achievements", "tips"]:
			_merge(base[k], over[k])
		else:
			base[k] = over[k]

func _migrate() -> void:
	if int(data.get("version", 1)) < VERSION:
		data["version"] = VERSION
	# repair: unknown unit ids / decks
	for id in data["units"].keys():
		if not Data.units.has(id):
			data["units"].erase(id)
	for i in data["decks"].size():
		data["decks"][i] = data["decks"][i].filter(func(u): return data["units"].has(u))
	if data["decks"][0].size() != 5:
		data["decks"][0] = MetaData.STARTER_DECK.duplicate()
	while data["decks"].size() < 3:
		data["decks"].append([])

func save() -> void:
	_dirty = false
	var tmp := PATH + ".tmp"
	var f := FileAccess.open(tmp, FileAccess.WRITE)
	if f == null:
		return
	f.store_string(JSON.stringify(data))
	f.close()
	if FileAccess.file_exists(PATH):
		DirAccess.copy_absolute(PATH, PATH + ".bak")
	DirAccess.rename_absolute(tmp, PATH)

func mark_dirty() -> void:
	_dirty = true
	_save_timer = 1.0
	changed.emit()

func reset_all() -> void:
	data = _default()
	save()
	changed.emit()

# ------------------------------------------------------------------ wallet
func coins() -> int: return int(data["wallet"]["coins"])
func gems() -> int: return int(data["wallet"]["gems"])
func tickets() -> int: return int(data["wallet"]["tickets"])

func add_wallet(kind: String, n: int) -> void:
	data["wallet"][kind] = maxi(0, int(data["wallet"][kind]) + n)
	mark_dirty()

func spend(kind: String, n: int) -> bool:
	if int(data["wallet"][kind]) < n:
		return false
	data["wallet"][kind] = int(data["wallet"][kind]) - n
	mark_dirty()
	return true

# ------------------------------------------------------------------ profile / xp
func player_level() -> int: return int(data["profile"]["level"])
func xp_needed(lv: int) -> int: return 80 + 45 * (lv - 1)

func add_xp(n: int) -> int:
	var p: Dictionary = data["profile"]
	p["xp"] = int(p["xp"]) + n
	var gained := 0
	while int(p["xp"]) >= xp_needed(int(p["level"])):
		p["xp"] = int(p["xp"]) - xp_needed(int(p["level"]))
		p["level"] = int(p["level"]) + 1
		gained += 1
		add_wallet("coins", 100 + 20 * int(p["level"]))
		if int(p["level"]) % 3 == 0:
			add_wallet("gems", 5)
		stat_max("player_level", int(p["level"]))
		leveled_up.emit(int(p["level"]))
	mark_dirty()
	return gained

# ------------------------------------------------------------------ units
func owns(id: String) -> bool: return data["units"].has(id)
func unit_level(id: String) -> int: return int(data["units"][id]["level"]) if owns(id) else 1
func unit_cards(id: String) -> int: return int(data["units"][id]["cards"]) if owns(id) else 0
func owned_count() -> int: return data["units"].size()

func unlock_unit(id: String) -> bool:
	if owns(id):
		return false
	data["units"][id] = {"level": 1, "cards": 0, "new": true}
	stat_max("units_owned", owned_count())
	unlocked.emit("unit", id)
	mark_dirty()
	return true

func add_cards(id: String, n: int) -> void:
	if not owns(id):
		unlock_unit(id)
	data["units"][id]["cards"] = int(data["units"][id]["cards"]) + n
	mark_dirty()

const LEVEL_CARDS := [0, 2, 4, 8, 14, 24, 40, 64, 100, 150]
const LEVEL_COINS := [0, 50, 120, 240, 420, 700, 1100, 1700, 2600, 4000]
const MAX_UNIT_LEVEL := 10

func upgrade_cost(id: String) -> Dictionary:
	var lv := unit_level(id)
	if lv >= MAX_UNIT_LEVEL:
		return {}
	var mult := 1.0 + 0.4 * Data.RARITIES.find(Data.units[id]["rarity"])
	return {"cards": LEVEL_CARDS[lv], "coins": int(LEVEL_COINS[lv] * mult)}

func can_upgrade(id: String) -> bool:
	var c := upgrade_cost(id)
	return not c.is_empty() and unit_cards(id) >= int(c["cards"]) and coins() >= int(c["coins"])

func upgrade_unit(id: String) -> bool:
	if not can_upgrade(id):
		return false
	var c := upgrade_cost(id)
	data["units"][id]["cards"] = unit_cards(id) - int(c["cards"])
	spend("coins", int(c["coins"]))
	data["units"][id]["level"] = unit_level(id) + 1
	mark_dirty()
	return true

func levels_map() -> Dictionary:
	var m := {}
	for id in data["units"]:
		m[id] = int(data["units"][id]["level"])
	return m

# ------------------------------------------------------------------ decks
func active_deck() -> Array: return data["decks"][int(data["active_deck"])]

func set_deck(i: int, ids: Array) -> void:
	data["decks"][i] = ids.duplicate()
	mark_dirty()

func deck_valid(ids: Array) -> bool:
	if ids.size() != 5:
		return false
	for id in ids:
		if not owns(id):
			return false
	return true

# ------------------------------------------------------------------ cosmetics
func has_cosmetic(id: String) -> bool: return id in data["cosmetics"]
func look() -> Dictionary: return data["profile"]["look"]

func unlock_cosmetic(id: String) -> void:
	if not has_cosmetic(id):
		data["cosmetics"].append(id)
		unlocked.emit("cosmetic", id)
		mark_dirty()

func cosmetic_available(c: Dictionary) -> bool:
	if has_cosmetic(c["id"]):
		return true
	var u: String = c["unlock"]
	if u.begins_with("lvl:") and player_level() >= int(u.substr(4)):
		return true
	return false

# ------------------------------------------------------------------ stats / quests / achievements
func stat(name: String) -> int:
	return int(data["stats"].get(name, 0))

func stat_add(name: String, n: int = 1) -> void:
	data["stats"][name] = stat(name) + n
	_quest_progress(name, n, false)
	_ach_check()
	mark_dirty()

func stat_max(name: String, v: int) -> void:
	if v > stat(name):
		data["stats"][name] = v
		_quest_progress(name, v, true)
		_ach_check()
		mark_dirty()

func _ach_check() -> void:
	for a in Data.achievements:
		var st: Dictionary = data["achievements"].get(a["id"], {})
		if st.get("done", false):
			continue
		if stat(a["stat"]) >= int(a["n"]):
			data["achievements"][a["id"]] = {"done": true, "claimed": false}
			unlocked.emit("achievement", a["id"])

func ach_state(id: String) -> Dictionary:
	return data["achievements"].get(id, {"done": false, "claimed": false})

func claim_achievement(id: String) -> bool:
	var st := ach_state(id)
	if not st.get("done", false) or st.get("claimed", false):
		return false
	var a: Dictionary = {}
	for x in Data.achievements:
		if x["id"] == id:
			a = x
	st["claimed"] = true
	data["achievements"][id] = st
	add_wallet("coins", int(a["coins"])); add_wallet("gems", int(a["gems"]))
	if a["unit"] != "":
		unlock_unit(a["unit"])
	if a["cos"] != "":
		unlock_cosmetic(a["cos"])
	mark_dirty()
	return true

func unclaimed_achievements() -> int:
	var n := 0
	for id in data["achievements"]:
		if data["achievements"][id].get("done", false) and not data["achievements"][id].get("claimed", false):
			n += 1
	return n

func today() -> String:
	var d := Time.get_date_dict_from_system()
	return "%04d-%02d-%02d" % [d["year"], d["month"], d["day"]]

func week_key() -> String:
	var t := Time.get_unix_time_from_system()
	return str(int(t / 604800.0))

func refresh_quests() -> void:
	var q: Dictionary = data["quests"]
	if q["daily_date"] != today():
		q["daily_date"] = today()
		var rng := RandomNumberGenerator.new()
		rng.seed = hash(today())
		var pool: Array = Data.quests_daily.duplicate()
		var list: Array = []
		var tier := clampi(player_level() / 8, 0, 2)
		for i in 3:
			var k := rng.randi() % pool.size()
			var d: Dictionary = pool[k]; pool.remove_at(k)
			list.append({"id": d["id"], "stat": d["stat"], "n": int(d["n"][tier]), "progress": 0, "claimed": false})
		q["daily"] = list
	if q["weekly_week"] != week_key():
		q["weekly_week"] = week_key()
		var rng2 := RandomNumberGenerator.new()
		rng2.seed = hash(week_key())
		var pool2: Array = Data.quests_weekly.duplicate()
		var list2: Array = []
		var tier2 := clampi(player_level() / 15, 0, 1)
		for i in 3:
			var k2 := rng2.randi() % pool2.size()
			var d2: Dictionary = pool2[k2]; pool2.remove_at(k2)
			list2.append({"id": d2["id"], "stat": d2["stat"], "n": int(d2["n"][tier2]), "progress": 0, "claimed": false})
		q["weekly"] = list2
	mark_dirty()

func _quest_progress(stat_name: String, v: int, is_max: bool) -> void:
	var q: Dictionary = data["quests"]
	for lst in [q["daily"], q["weekly"]]:
		for it in lst:
			if it["stat"] == stat_name or (it["stat"] == "rank5" and stat_name == "max_rank" and v >= 5):
				if it["stat"] == "rank5":
					it["progress"] = 1
				elif is_max:
					it["progress"] = maxi(int(it["progress"]), v)
				else:
					it["progress"] = int(it["progress"]) + v

func quest_def(id: String) -> Dictionary:
	for d in Data.quests_daily:
		if d["id"] == id:
			return d
	for d in Data.quests_weekly:
		if d["id"] == id:
			return d
	return {}

func claim_quest(kind: String, idx: int) -> bool:
	var it: Dictionary = data["quests"][kind][idx]
	if it["claimed"] or int(it["progress"]) < int(it["n"]):
		return false
	it["claimed"] = true
	var d := quest_def(it["id"])
	add_wallet("coins", int(d["coins"])); add_wallet("gems", int(d["gems"]))
	add_xp(25 if kind == "daily" else 80)
	mark_dirty()
	return true

func daily_reward_available() -> bool:
	return data["daily_reward"]["last"] != today()

func daily_reward_today() -> Dictionary:
	var streak := int(data["daily_reward"]["streak"])
	var day := streak % 7
	return {"day": day + 1, "coins": [50, 75, 100, 150, 200, 300, 500][day], "gems": [0, 0, 1, 0, 2, 0, 5][day], "tickets": [0, 0, 0, 1, 0, 0, 1][day]}

func claim_daily_reward() -> Dictionary:
	if not daily_reward_available():
		return {}
	var r := daily_reward_today()
	var last: String = data["daily_reward"]["last"]
	var yest := Time.get_datetime_string_from_unix_time(int(Time.get_unix_time_from_system()) - 86400).substr(0, 10)
	data["daily_reward"]["streak"] = int(data["daily_reward"]["streak"]) + 1 if (last == yest or last == "") else 1
	data["daily_reward"]["last"] = today()
	add_wallet("coins", r["coins"]); add_wallet("gems", r["gems"]); add_wallet("tickets", r["tickets"])
	stat_add("daily_claims", 1)
	return r

# ------------------------------------------------------------------ campaign
func level_cleared(id: String) -> bool: return data["campaign"]["cleared"].has(id)
func level_info(id: String) -> Dictionary: return data["campaign"]["cleared"].get(id, {})

func chapter_unlocked(ch: int) -> bool:
	if ch <= 1:
		return true
	return level_cleared("%d-6" % (ch - 1))

func level_unlocked(ch: int, lv: int) -> bool:
	if not chapter_unlocked(ch):
		return false
	return lv <= 1 or level_cleared("%d-%d" % [ch, lv - 1])

func next_level() -> String:
	for ch in range(1, 10):
		for lv in range(1, 7):
			var id := "%d-%d" % [ch, lv]
			if not level_cleared(id):
				return id
	return "9-6"

func chapters_cleared() -> int:
	var n := 0
	for ch in range(1, 10):
		if level_cleared("%d-6" % ch):
			n += 1
	return n

func setting(k: String) -> Variant: return data["settings"].get(k)
func set_setting(k: String, v: Variant) -> void:
	data["settings"][k] = v
	mark_dirty()
