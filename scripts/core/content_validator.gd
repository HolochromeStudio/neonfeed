class_name ContentValidator
extends RefCounted
## Validates all static content. Run from the dev menu or headless: godot --headless --path . res://tests/validate.tscn

const KNOWN_TRAITS := ["ramp", "crit", "pierce", "multi", "splash", "chain", "status", "pull", "push", "pierce_armor", "fast_bonus", "boss", "dup", "portal", "rewind",
	"mark_fast", "sp_kill", "cleanse", "strip", "stun_hit", "fear", "aura_row", "aura_col", "aura_adj", "aura_all", "aura_tag", "heal_city", "shield_ally", "sp_wave",
	"merge_luck", "pulse", "stun_pulse", "cone", "gate", "rank_proj", "oil_burn", "abduct"]
const KNOWN_NUM_OPS := ["dmg", "spd", "crit", "crit_m", "range", "aoe", "status_d", "status_c", "boss", "pierce", "proj", "chain_extra", "splash_pct", "exec", "sp_kill", "sp_flat",
	"sp_wave", "deploy_cost", "deploy_inc", "deploy_rank", "merge_up", "merge_keep", "merge_refund", "city_hp", "city_regen", "leak_red", "slow_p", "marked", "push", "dup",
	"first_hit", "gate", "kill_spd", "crit_sp", "leak_extra", "pierce_n", "proj_speed", "bounce", "chain_pct", "lob_extra", "burn_dmg", "stun_c", "wet_c", "oil_c", "ab_c", "fear_c",
	"elite_sp", "sp_chance", "sp_now", "clear_bonus", "boss_sp", "free_deploy", "double_deploy", "fair_deploy", "deploy_reset", "merge_haste", "merge_blast", "rank_dividend",
	"match_dmg", "high_rank_dmg", "adj_dmg", "syn_mult", "enemy_slow", "shield_every", "boss_slow", "merge_down", "enemy_fast", "enemy_hp", "exec_kill", "stun_d", "aura_mult"]
const KNOWN_RULES := ["crit_chain", "double_splash", "shockwave", "wet_shock", "contagion", "parking_meter", "interest", "chip_in", "wave_free", "trade_in", "merge_shield", "rank8",
	"centre_power", "corner_power", "loner_power", "wild_tag", "last_stand", "toll_gate", "hazard_lights", "second_chance", "giant_slayer", "boss_cache", "weak_point", "boss_prep",
	"bad_neighbours", "gamble", "no_parking", "bumper", "gridlock", "emergency_lane", "rush_hour", "carpool", "green_wave", "overtime", "one_way", "parking_ban", "chaos_theory",
	"jackpot", "lucky_cone", "taxi_plus", "lottery", "vintage_plus", "glove_box", "black_box", "boss_horn"]

static func run() -> Array:
	var errs: Array = []
	var warn: Array = []
	# units
	if Data.units.size() != 60:
		errs.append("expected 60 units, found %d" % Data.units.size())
	for id in Data.units:
		var u: Dictionary = Data.units[id]
		if not Atlas.has("veh_" + id):
			errs.append("unit %s: missing atlas art veh_%s" % [id, id])
		if u["tags"].size() < 2: errs.append("unit %s: needs >=2 tags" % id)
		if u["roles"].is_empty(): errs.append("unit %s: no role" % id)
		if String(u["flavor"]) == "" or String(u["ability"]) == "": errs.append("unit %s: missing flavour/ability text" % id)
		if not (u["rarity"] in Data.RARITIES): errs.append("unit %s: bad rarity" % id)
		for t in u["traits"]:
			if not (t["k"] in KNOWN_TRAITS): errs.append("unit %s: unknown trait %s" % [id, t["k"]])
			if t["k"] == "status" and not Data.statuses.has(t["st"]): errs.append("unit %s: unknown status %s" % [id, t["st"]])
			if t.has("st") and not Data.statuses.has(t["st"]): errs.append("unit %s: trait status %s unknown" % [id, t["st"]])
		if not Audio.unit_audio(id).has("shoot"): errs.append("unit %s: no audio def" % id)
		if not Data.unit_visual(id).has("art") or Data.unit_anim(id)["clips"].size() < 16: errs.append("unit %s: incomplete visual/animation def" % id)
		if Atlas.wheels("veh_" + id).is_empty() and not (id in ["ufo", "mecha_vehicle", "rocket_car", "experimental_ev", "winged_van", "portal_bus"]): warn.append("unit %s has no wheel overlay" % id)
	for r in Data.RARITIES:
		if Data.units_of_rarity(r).size() != 10: errs.append("rarity %s should have 10 units" % r)
	# enemies / bosses
	for id in Data.enemies:
		if not Atlas.has(Data.enemies[id]["art"]): errs.append("enemy %s: missing art" % id)
	for id in Data.bosses:
		if not Atlas.has(Data.bosses[id]["art"]): errs.append("boss %s: missing art" % id)
	# upgrades
	if Data.upgrades.size() < 120: errs.append("need >=120 upgrades, have %d" % Data.upgrades.size())
	var seen := {}
	for up in Data.upgrades:
		if seen.has(up["id"]): errs.append("duplicate upgrade id " + up["id"])
		seen[up["id"]] = true
		_check_ops(up["ops"], "upgrade " + up["id"], errs)
	if Data.relics.size() < 50: errs.append("need >=50 relics, have %d" % Data.relics.size())
	for r in Data.relics:
		_check_ops(r["ops"], "relic " + r["id"], errs)
	# synergies
	var all_tags := {}
	for id in Data.units:
		for t in Data.units[id]["tags"]:
			all_tags[t] = true
	for s in Data.synergies:
		if s.has("tag") and not all_tags.has(s["tag"]): errs.append("synergy %s: tag %s has no units" % [s["id"], s["tag"]])
		if s.has("mix"):
			for t in s["mix"]:
				if not all_tags.has(t): errs.append("synergy %s: mix tag %s has no units" % [s["id"], t])
	# campaign
	var unlock_seen := {}
	for ch in Data.chapters:
		if not Data.bosses.has(ch["boss"]): errs.append("chapter %s: bad boss" % ch["id"])
		if not Atlas.has("biome_" + ch["biome"]): errs.append("chapter %s: missing biome art" % ch["id"])
		for e in ch["pool"]:
			if not Data.enemies.has(e): errs.append("chapter %s: unknown enemy %s" % [ch["id"], e])
		for l in ch["levels"]:
			if l["unlock"] != "":
				if unlock_seen.has(l["unlock"]): errs.append("unit unlocked twice: " + l["unlock"])
				unlock_seen[l["unlock"]] = true
	for id in Data.units:
		if not unlock_seen.has(id) and not (id in MetaData.STARTER_UNITS):
			var via_ach := false
			for a in Data.achievements:
				if a["unit"] == id:
					via_ach = true
			if not via_ach: errs.append("unit %s is unobtainable" % id)
	# story
	for sc in Data.story["scenes"]:
		for ln in Data.story["scenes"][sc]:
			if not Data.story["cast"].has(ln[0]): errs.append("scene %s: unknown speaker %s" % [sc, ln[0]])
			elif Data.story["cast"][ln[0]]["art"] != "" and not Atlas.has(Data.story["cast"][ln[0]]["art"]): errs.append("scene %s: missing art for %s" % [sc, ln[0]])
	for ch in Data.chapters:
		for k in ["pre", "boss", "post"]:
			if not Data.story["scenes"].has("ch%d_%s" % [ch["id"], k]): errs.append("missing scene ch%d_%s" % [ch["id"], k])
	for p in Data.story["intro_panels"]:
		if not Atlas.has(p["cut"]): errs.append("intro panel art missing " + p["cut"])
	# cosmetics
	for c in Data.cosmetics:
		if c["key"] != "" and not Atlas.has(c["key"]): errs.append("cosmetic %s: missing art %s" % [c["id"], c["key"]])
	# achievements / quests
	for a in Data.achievements:
		if a["unit"] != "" and not Data.units.has(a["unit"]): errs.append("achievement %s: bad unit" % a["id"])
		if a["cos"] != "" and not Data.cosmetics_by_id.has(a["cos"]): errs.append("achievement %s: bad cosmetic" % a["id"])
	for s in Data.statuses:
		if not Atlas.has(Data.statuses[s]["icon"]): errs.append("status %s: icon missing" % s)
	for e in errs:
		push_error("[validator] " + e)
	for w in warn:
		print("[validator] note: ", w)
	print("[validator] units=%d upgrades=%d relics=%d synergies=%d chapters=%d achievements=%d cosmetics=%d -> %d errors" % [Data.units.size(), Data.upgrades.size(), Data.relics.size(), Data.synergies.size(), Data.chapters.size(), Data.achievements.size(), Data.cosmetics.size(), errs.size()])
	return errs

static func _check_ops(ops: Array, who: String, errs: Array) -> void:
	for op in ops:
		var k: String = op[0]
		if k in ["tag_dmg", "tag_spd", "tag_crit", "tag_aoe", "tag_sd", "tag_proj", "rar_dmg", "row_dmg", "row_range", "col_dmg", "col_spd"]:
			continue
		if k == "rule":
			if not (op[1] in KNOWN_RULES):
				errs.append("%s: unknown rule %s" % [who, op[1]])
		elif not (k in KNOWN_NUM_OPS):
			errs.append("%s: unknown op %s" % [who, k])
