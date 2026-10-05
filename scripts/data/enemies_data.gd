class_name EnemiesData
## Enemy traffic + bosses + status catalogue.
## hp/speed are rank-0 values; speed in px/s along the road path. HP is multiplied per wave by the sim.

static func _e(id: String, name: String, hp: float, speed: float, leak: int, sp: float, extra: Dictionary = {}) -> Dictionary:
	var d := {"id": id, "name": name, "hp": hp, "speed": speed, "leak": leak, "sp": sp, "armor": 0.0, "scale": 1.0, "art": "en_" + id}
	d.merge(extra, true)
	return d

static func enemies() -> Array:
	return [
		_e("slow_car", "Slow Car", 30, 70, 1, 1.0, {"blurb": "Meanders. Honks."}),
		_e("speedster", "Speedster", 18, 150, 1, 1.0, {"blurb": "Fast and fragile."}),
		_e("suv", "SUV", 75, 76, 1, 1.5, {"armor": 0.2, "blurb": "Lightly armoured."}),
		_e("truck", "Truck", 170, 55, 2, 2.5, {"scale": 1.12, "blurb": "Slow and heavy."}),
		_e("bus", "Bus", 130, 60, 2, 2.5, {"scale": 1.15, "split": "slow_car", "split_n": 3, "blurb": "Spills 3 cars when destroyed."}),
		_e("police_chase", "Police Chase", 55, 112, 1, 2.0, {"haste_aura": 0.25, "aura_r": 170.0, "blurb": "Sirens speed up nearby traffic."}),
		_e("gang_cars", "Gang Cars", 42, 92, 1, 1.5, {"pack": 3, "blurb": "Arrives as a pack."}),
		_e("motorcycle", "Motorcycle", 22, 195, 1, 2.0, {"dodge": 0.25, "blurb": "25% to dodge hits."}),
		_e("armored_truck", "Armored Truck", 230, 50, 3, 4.0, {"armor": 0.45, "scale": 1.12, "blurb": "45% armor."}),
		_e("road_cleaner", "Road Cleaner", 95, 70, 1, 2.5, {"cleanse_aura": 4.0, "aura_r": 150.0, "blurb": "Cleanses debuffs nearby."}),
	]

static func bosses() -> Array:
	return [
		{"id": "monster_truck", "name": "Big Bertha", "title": "Monster Truck", "hp": 2600, "speed": 42, "leak": 10, "sp": 60, "armor": 0.1, "scale": 1.7, "art": "boss_monster_truck",
			"abilities": [{"k": "stomp", "every": 8.0, "d": 3.0}], "immune_push": true, "blurb": "Stomps stun a vehicle."},
		{"id": "helicopter", "name": "Whirlybird", "title": "News Chopper", "hp": 2300, "speed": 80, "leak": 10, "sp": 60, "armor": 0.0, "scale": 1.6, "art": "boss_helicopter", "flying": true,
			"abilities": [{"k": "bomb", "every": 6.0, "d": 4.0, "n": 2}], "blurb": "Flies a straight shortcut and jams vehicles."},
		{"id": "tank", "name": "General Gridlock", "title": "Tank", "hp": 3300, "speed": 38, "leak": 12, "sp": 70, "armor": 0.4, "scale": 1.6, "art": "boss_tank",
			"abilities": [{"k": "shell", "every": 7.0, "d": 5.0}], "blurb": "40% armor. Shells silence vehicles."},
		{"id": "drill_truck", "name": "Burrowing Bruno", "title": "Drill Truck", "hp": 3000, "speed": 46, "leak": 12, "sp": 70, "armor": 0.15, "scale": 1.6, "art": "boss_drill_truck",
			"abilities": [{"k": "burrow", "every": 10.0, "d": 2.2, "jump": 320.0}], "blurb": "Burrows - untargetable - and resurfaces ahead."},
		{"id": "ufo", "name": "Overtime", "title": "UFO", "hp": 3600, "speed": 55, "leak": 14, "sp": 80, "armor": 0.0, "scale": 1.5, "art": "boss_ufo", "flying": true,
			"abilities": [{"k": "abduct", "every": 11.0, "d": 8.0}], "blurb": "Abducts a vehicle for 8s."},
		{"id": "mecha", "name": "MECHA-JAM", "title": "Mecha Boss", "hp": 6200, "speed": 40, "leak": 20, "sp": 120, "armor": 0.2, "scale": 1.6, "art": "boss_mecha",
			"phases": true, "abilities": [{"k": "stomp", "every": 9.0, "d": 3.0}], "blurb": "Three phases: shield, reinforcements, rage."},
	]

## id -> {name, kind (buff/debuff), target (enemy/unit/both), desc, icon}
static func statuses() -> Dictionary:
	return {
		"slow": {"name": "Slow", "kind": "debuff", "desc": "Moves slower.", "icon": "ui_status_slow"},
		"stun": {"name": "Stun", "kind": "debuff", "desc": "Cannot move or attack.", "icon": "ui_status_stun"},
		"burn": {"name": "Burn", "kind": "debuff", "desc": "Takes fire damage over time.", "icon": "ui_status_burn"},
		"wet": {"name": "Wet", "kind": "debuff", "desc": "Soaked. Shock chains harder. Extinguishes Burn.", "icon": "ui_status_wet"},
		"shock": {"name": "Shock", "kind": "debuff", "desc": "Takes extra damage from electric hits.", "icon": "ui_status_shock"},
		"marked": {"name": "Marked", "kind": "debuff", "desc": "Takes +30% damage (police +20% more).", "icon": "ui_status_marked"},
		"armor_break": {"name": "Armor Break", "kind": "debuff", "desc": "Armor halved.", "icon": "ui_status_armor_break"},
		"pushback": {"name": "Pushback", "kind": "debuff", "desc": "Shoved backward along the road.", "icon": "ui_status_pushback"},
		"silence": {"name": "Silence", "kind": "debuff", "desc": "Abilities disabled.", "icon": "ui_status_silence"},
		"haste": {"name": "Haste", "kind": "buff", "desc": "Faster movement / attacks.", "icon": "ui_status_haste"},
		"shield": {"name": "Shield", "kind": "buff", "desc": "Absorbs the next debuff or hit.", "icon": "ui_status_shield"},
		"jammed": {"name": "Jammed", "kind": "debuff", "desc": "Attack speed halved.", "icon": "ui_status_jammed"},
		"oil": {"name": "Oil", "kind": "debuff", "desc": "Slick: +25% speed, burns hotter.", "icon": "ui_status_oil"},
		"fear": {"name": "Fear", "kind": "debuff", "desc": "Turns around and flees.", "icon": "ui_status_fear"},
	}
