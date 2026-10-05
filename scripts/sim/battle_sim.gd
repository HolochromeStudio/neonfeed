class_name BattleSim
extends RefCounted
## Deterministic battle simulation (no nodes). The BattleView renders `events`; bots and tests drive it headlessly.
##
## TRAIT CATALOG (unit "traits" entries, key "k"):
##  ramp{per,max}  crit{c,m}  pierce{n}  multi{n}  splash{r,pct,st?,sd?}  chain{n,pct,r}  status{st,d,c,p?}  pull{d}  push{d,r?}
##  pierce_armor{pct} fast_bonus{spd,m} boss{m} dup{c} portal{c,m} rewind{c,d} mark_fast{spd,d} sp_kill{n} cleanse{every} strip
##  stun_hit{c,d} fear{c,d} aura_row/col/adj/all/tag{dmg,spd,tag} heal_city{every,n} shield_ally{every} sp_wave{n} merge_luck{c}
##  pulse{every,m} stun_pulse{every,d,r} cone{every,d} gate{n} rank_proj{ranks} oil_burn abduct{every}

const RANK_DMG := [1.0, 2.7, 7.0, 18.0, 46.0, 118.0, 300.0, 760.0]
const RANK_SPD := [1.0, 1.0, 1.04, 1.08, 1.12, 1.16, 1.2, 1.25]
const MAX_RANK_STD := 7
const SP_SCALE := 3.4
const SPEED_SCALE := 1.4
const FIELD_W := 1080.0

# ---------------------------------------------------------------- inner classes
class SimUnit:
	var id: int
	var def: Dictionary
	var uid: String
	var rank: int = 1
	var slot: int = -1
	var owner: int = 0
	var cd: float = 0.3
	var level: int = 1
	var st: Dictionary = {}      # status -> {t, p}
	var timers: Dictionary = {}
	var kills: int = 0
	var dmg_done: float = 0.0
	var ramp: float = 0.0
	var last_target: int = -1
	var merge_haste_t: float = 0.0
	var away_t: float = 0.0      # abducted
	var shots: int = 0
	var crit_ready: bool = false
	# cached derived stats
	var dmg_mult: float = 1.0
	var spd_mult: float = 1.0
	var crit_c: float = 0.0
	var crit_m: float = 2.0
	var range_mult: float = 1.0
	var proj_extra: int = 0
	var aoe_mult: float = 1.0
	var sd_mult: float = 1.0
	var pierce: float = 0.0
	var boss_mult: float = 0.0
	var pos: Vector2 = Vector2.ZERO
	func tags() -> Array: return def["tags"]

class SimEnemy:
	var id: int
	var def: Dictionary
	var eid: String
	var hp: float
	var max_hp: float
	var progress: float = 0.0
	var speed: float
	var armor: float = 0.0
	var st: Dictionary = {}
	var pos: Vector2 = Vector2.ZERO
	var dir: Vector2 = Vector2.RIGHT
	var elite: bool = false
	var boss: bool = false
	var shield: float = 0.0
	var alive: bool = true
	var leaked: bool = false
	var untargetable_t: float = 0.0
	var timers: Dictionary = {}
	var phase: int = 0
	var sp: float = 1.0
	var sp_mult: float = 1.0
	var size_mult: float = 1.0
	var leak: int = 1
	var flying: bool = false
	var sent: bool = false
	var spawn_t: float = 0.0
	var hits: int = 0
	var fear_back: bool = false

# ---------------------------------------------------------------- config / layout
var cfg: Dictionary
var rng := RandomNumberGenerator.new()
var wave_rng := RandomNumberGenerator.new()
var cols: int = 5
var rows: int = 3
var cell := Vector2(190, 190)
var grid_origin := Vector2(65, 960)
var path_pts: PackedVector2Array = PackedVector2Array()
var path_cum: PackedFloat32Array = PackedFloat32Array()
var path_len: float = 0.0
var flying_len: float = 0.0

# ---------------------------------------------------------------- state
var time: float = 0.0
var state: String = "countdown"   # countdown | wave | offer | ended
var wave: int = 0                 # current wave number (1-based once started)
var total_waves: int = 10         # 0 = endless
var wave_timer: float = 3.0
var wave_spawn_left: Array = []   # [{t, id, elite, boss}]
var wave_clock: float = 0.0
var wave_total_enemies: int = 0
var wave_kills: int = 0
var next_id: int = 1
var slots: Array = []             # slot -> SimUnit or null
var units: Array = []
var enemies: Array = []
var pending: Array = []           # in-flight projectiles
var hazards: Array = []           # cones
var events: Array = []
var deck: Array = []
var partner_deck: Array = []
var unit_levels: Dictionary = {}
var city_hp: int = 20
var city_max: int = 20
var sp: float = 50.0
var sp_partner: float = 50.0
var deploy_count: int = 0
var deploy_count_p: int = 0
var gates: int = 0
var mods: Dictionary = {}
var tag_mods: Dictionary = {}     # "dmg"|"spd"|"crit"|"aoe"|"sd"|"proj" -> {tag: v}
var rar_dmg: Dictionary = {}
var row_mods: Array = []          # [kind,row,v]
var col_mods: Array = []
var rules: Dictionary = {}
var upgrades_taken: Dictionary = {}
var relics_owned: Array = []
var synergy_active: Array = []    # [{id, tier, name, desc}]
var syn_fx: Dictionary = {}       # aggregated global synergy fx
var syn_unit_fx: Array = []       # [{tag, fx}]
var stats: Dictionary = {}
var offer: Array = []
var offer_kind: String = ""
var next_offer_wave: int = 3
var rng_visual_seed: int = 1
var dirty: bool = true
var recompute_t: float = 0.0
var kill_count: int = 0
var kills_this_wave_spd: float = 0.0
var free_deploys: int = 0
var wave_free_used: bool = false
var second_chance_used: bool = false
var green_t: float = 12.0
var misc_timers: Dictionary = {}
var boss_alive: bool = false
var result: String = ""           # "", "victory", "defeat"
var sent_queue: Array = []        # enemies injected by PvP
var partner_ai: Object = null
var is_player_sim: bool = true
var level_def: Dictionary = {}
var biome: String = "city_center"
var enemy_pool: Array = []
var chapter_idx: int = 1
var difficulty: float = 1.0
var enemy_hp_mult_extra: float = 0.0
var enemy_speed_mult_extra: float = 0.0
var no_upgrades: bool = false
var tutorial: bool = false
var boss_wave_set: Array = []
var hp_scale_base: float = 1.14
var coop: bool = false

signal ended(result: String)

# ================================================================= setup
func setup(config: Dictionary) -> void:
	cfg = config
	rng.seed = int(cfg.get("seed", 12345))
	wave_rng.seed = int(cfg.get("wave_seed", cfg.get("seed", 12345)))
	cols = int(cfg.get("cols", 5)); rows = int(cfg.get("rows", 3))
	cell = cfg.get("cell", Vector2(190, 190))
	grid_origin = cfg.get("grid_origin", Vector2((FIELD_W - cols * cell.x) * 0.5, 960))
	coop = bool(cfg.get("coop", false))
	deck = cfg.get("deck", ["taxi", "police", "fire_engine", "tow_truck", "city_bus"]).duplicate()
	partner_deck = cfg.get("partner_deck", []).duplicate()
	unit_levels = cfg.get("levels", {})
	city_max = int(cfg.get("city_hp", 20)); city_hp = city_max
	sp = float(cfg.get("start_sp", 50)); sp_partner = sp
	total_waves = int(cfg.get("waves", 10))
	biome = cfg.get("biome", "city_center")
	chapter_idx = int(cfg.get("chapter", 1))
	difficulty = float(cfg.get("difficulty", 1.0))
	enemy_pool = cfg.get("enemy_pool", ["slow_car", "speedster", "suv", "truck"])
	boss_wave_set = cfg.get("boss_waves", [])
	no_upgrades = bool(cfg.get("no_upgrades", false))
	tutorial = bool(cfg.get("tutorial", false))
	is_player_sim = bool(cfg.get("player_sim", true))
	next_offer_wave = int(cfg.get("first_offer", 3))
	_build_path()
	slots.clear()
	for i in cols * rows:
		slots.append(null)
	for k in ["dmg", "spd", "crit", "aoe", "sd", "proj", "aura", "crit_m"]:
		tag_mods[k] = {}
	for st in ["kills", "deploys", "merges", "leaks", "max_rank", "damage", "crits", "sp_earned", "elites", "bosses", "upgrades"]:
		stats[st] = 0
	# starting loadout (meta items / boosters)
	for rid in cfg.get("start_relics", []):
		_add_relic(rid, true)
	mods["sp_start"] = float(cfg.get("bonus_sp", 0))
	sp += mods["sp_start"]
	gates = int(_m("gate"))
	dirty = true

func _build_path() -> void:
	path_pts.clear()
	var ys := [330.0, 560.0, 790.0]
	var r := 115.0
	var xl := 80.0
	var xr := 1000.0
	path_pts.append(Vector2(-70, ys[0]))
	path_pts.append(Vector2(xr, ys[0]))
	for i in range(1, 13):
		var a := -PI / 2 + PI * i / 12.0
		path_pts.append(Vector2(xr + cos(a) * r, (ys[0] + ys[1]) * 0.5 + sin(a) * r))
	path_pts.append(Vector2(xl, ys[1]))
	for i in range(1, 13):
		var a := -PI / 2 - PI * i / 12.0
		path_pts.append(Vector2(xl + cos(a) * r, (ys[1] + ys[2]) * 0.5 + sin(a) * r))
	path_pts.append(Vector2(1150, ys[2]))
	path_cum.resize(path_pts.size())
	var acc := 0.0
	for i in path_pts.size():
		if i > 0:
			acc += path_pts[i].distance_to(path_pts[i - 1])
		path_cum[i] = acc
	path_len = acc
	flying_len = path_pts[0].distance_to(Vector2(1150, 790)) * 0.62

func path_pos(d: float) -> Vector2:
	if d <= 0.0:
		return path_pts[0]
	if d >= path_len:
		return path_pts[path_pts.size() - 1]
	var lo := 0
	var hi := path_cum.size() - 1
	while hi - lo > 1:
		var mid := (lo + hi) >> 1
		if path_cum[mid] <= d:
			lo = mid
		else:
			hi = mid
	var seg := path_cum[hi] - path_cum[lo]
	var t := (d - path_cum[lo]) / maxf(seg, 0.001)
	return path_pts[lo].lerp(path_pts[hi], t)

func path_dir(d: float) -> Vector2:
	var a := path_pos(maxf(d - 6.0, 0.0))
	var b := path_pos(minf(d + 6.0, path_len))
	var v := b - a
	return v.normalized() if v.length() > 0.001 else Vector2.RIGHT

func slot_pos(i: int) -> Vector2:
	return grid_origin + Vector2((i % cols) + 0.5, (i / cols) + 0.5) * cell

func slot_owner(i: int) -> int:
	if not coop:
		return 0
	return 1 if (i / cols) < rows / 2 else 0

func slot_count() -> int:
	return slots.size()

# ================================================================= helpers
func _m(k: String) -> float:
	return float(mods.get(k, 0.0))

func has_rule(r: String) -> bool:
	return rules.has(r)

func _ev(e: Dictionary) -> void:
	events.append(e)

func hp_scale(w: int) -> float:
	var ch := 1.0 + 0.25 * mini(chapter_idx - 1, 2) + 0.55 * clampi(chapter_idx - 3, 0, 3) + 0.9 * maxi(chapter_idx - 6, 0)
	return pow(hp_scale_base, maxf(0.0, w - 1.0)) * ch * difficulty * (1.0 + enemy_hp_mult_extra + _m("enemy_hp"))

func unit_base_dmg(u: SimUnit) -> float:
	var lv := 1.0 + 0.09 * (u.level - 1)
	return float(u.def["dmg"]) * RANK_DMG[u.rank - 1] * lv

func unit_interval(u: SimUnit) -> float:
	return float(u.def["interval"]) / RANK_SPD[u.rank - 1]

func max_rank() -> int:
	return 8 if has_rule("rank8") else MAX_RANK_STD

func empty_slots(owner: int = 0) -> Array:
	var out: Array = []
	for i in slots.size():
		if slots[i] == null and slot_owner(i) == owner:
			out.append(i)
	return out

func unit_count(owner: int = -1) -> int:
	var n := 0
	for u: SimUnit in units:
		if owner < 0 or u.owner == owner:
			n += 1
	return n

func enemy_by_id(eid: int) -> SimEnemy:
	for e: SimEnemy in enemies:
		if e.id == eid:
			return e
	return null

func unit_by_id(uid: int) -> SimUnit:
	for u: SimUnit in units:
		if u.id == uid:
			return u
	return null

func deploy_cost(owner: int = 0) -> int:
	if free_deploys > 0 and owner == 0:
		return 0
	var n := deploy_count if owner == 0 else deploy_count_p
	var inc := 2.5 * (1.0 + _m("deploy_inc"))
	var base := 10.0 + inc * float(n)
	var mult := 1.0 + _m("deploy_cost")
	if has_rule("parking_ban"):
		mult += 0.5
	return maxi(1, int(round(base * mult)))

func can_deploy(owner: int = 0) -> bool:
	var c := deploy_cost(owner)
	var have := sp if owner == 0 else sp_partner
	return state != "ended" and have >= c and empty_slots(owner).size() > 0

func wave_progress() -> float:
	if total_waves <= 0:
		return 0.0
	return clampf(float(wave) / float(total_waves), 0.0, 1.0)

# ================================================================= deploy / merge / move
func deploy(owner: int = 0, forced_slot: int = -1, forced_unit: String = "") -> SimUnit:
	if not can_deploy(owner):
		return null
	var empties := empty_slots(owner)
	var slot: int = forced_slot if forced_slot >= 0 and slots[forced_slot] == null else empties[rng.randi() % empties.size()]
	var dk: Array = deck if owner == 0 else partner_deck
	if dk.is_empty():
		dk = deck
	var uid: String = forced_unit if forced_unit != "" else _pick_deck_unit(dk, owner)
	var cost := deploy_cost(owner)
	if owner == 0:
		if free_deploys > 0:
			free_deploys -= 1
		sp -= cost
		deploy_count += 1
	else:
		sp_partner -= cost
		deploy_count_p += 1
	var rank := 1
	if has_rule("parking_ban"):
		rank = 2
	elif rng.randf() < _m("deploy_rank"):
		rank = 2
	var u := _spawn_unit(uid, rank, slot, owner)
	stats["deploys"] += 1
	_ev({"t": "deploy", "unit": u.id, "slot": slot, "cost": cost})
	if rng.randf() < _m("double_deploy") and not empty_slots(owner).is_empty():
		var e2 := empty_slots(owner)
		_spawn_unit(_pick_deck_unit(dk, owner), 1, e2[rng.randi() % e2.size()], owner)
		_ev({"t": "deploy", "unit": units[units.size() - 1].id, "slot": units[units.size() - 1].slot, "cost": 0})
	if has_rule("chip_in") and String(u.def["rarity"]) == "common":
		sp += 2
	if has_rule("wave_free") and not wave_free_used and owner == 0:
		wave_free_used = true
		sp += cost
		_ev({"t": "text", "msg": "Free deploy!", "pos": slot_pos(slot)})
	dirty = true
	return u

func _pick_deck_unit(dk: Array, owner: int) -> String:
	if rng.randf() < _m("fair_deploy"):
		var counts := {}
		for d in dk:
			counts[d] = 0
		for u: SimUnit in units:
			if u.owner == owner and counts.has(u.uid):
				counts[u.uid] += 1
		var best: Array = []
		var bc := 9999
		for d in dk:
			if counts[d] < bc:
				bc = counts[d]; best = [d]
			elif counts[d] == bc:
				best.append(d)
		return best[rng.randi() % best.size()]
	return dk[rng.randi() % dk.size()]

func _spawn_unit(uid: String, rank: int, slot: int, owner: int) -> SimUnit:
	var u := SimUnit.new()
	u.id = next_id; next_id += 1
	u.def = Data.units[uid]; u.uid = uid
	u.rank = rank; u.slot = slot; u.owner = owner
	u.level = int(unit_levels.get(uid, 1)) if owner == 0 else 1 + int(chapter_idx / 3)
	u.cd = 0.4
	u.pos = slot_pos(slot)
	slots[slot] = u
	units.append(u)
	for t in u.def["traits"]:
		if t["k"] in ["heal_city", "shield_ally", "cleanse", "stun_pulse", "cone", "pulse", "abduct"]:
			u.timers[t["k"]] = float(t.get("every", 8.0)) * rng.randf_range(0.5, 1.0)
	stats["max_rank"] = maxi(stats["max_rank"], rank)
	return u

func can_merge(a: SimUnit, b: SimUnit) -> bool:
	return a != null and b != null and a != b and a.uid == b.uid and a.rank == b.rank and a.rank < max_rank() and a.owner == b.owner

func mergeable_pairs(owner: int = 0) -> Array:
	var out: Array = []
	for i in units.size():
		for j in range(i + 1, units.size()):
			if units[i].owner == owner and can_merge(units[i], units[j]):
				out.append([units[i], units[j]])
	return out

func merge(a: SimUnit, b: SimUnit) -> SimUnit:
	if not can_merge(a, b):
		return null
	var owner := a.owner
	var dk: Array = deck if owner == 0 else partner_deck
	if dk.is_empty():
		dk = deck
	var new_rank := a.rank + 1
	if rng.randf() < _m("merge_up") + _merge_luck_units(owner):
		new_rank += 1
	if has_rule("chaos_theory"):
		var r := rng.randf()
		if r < 0.35:
			new_rank += 2
		elif r < 0.50:
			new_rank -= 1
	if rng.randf() < _m("merge_down"):
		new_rank -= 1
	new_rank = clampi(new_rank, 1, max_rank())
	var uid: String = a.uid if rng.randf() < _m("merge_keep") else _pick_deck_unit(dk, owner)
	var slot_b := b.slot
	var slot_a := a.slot
	_remove_unit(a); _remove_unit(b)
	var u := _spawn_unit(uid, new_rank, slot_b, owner)
	u.merge_haste_t = 6.0 if _m("merge_haste") > 0.0 else 0.0
	if has_rule("merge_shield"):
		u.st["shield"] = {"t": 10.0, "p": 1.0}
	stats["merges"] += 1
	var refund := _m("merge_refund") + (_m("rank_dividend") if new_rank >= 4 else 0.0)
	if owner == 0:
		sp += refund
	if has_rule("trade_in") and a.rank == 1 and not misc_timers.has("trade_in_wave_%d" % wave):
		misc_timers["trade_in_wave_%d" % wave] = true
		free_deploys += 1
	if _m("merge_blast") > 0.0:
		var dmg := unit_base_dmg(u) * _m("merge_blast")
		for e: SimEnemy in enemies.duplicate():
			if e.alive and not e.leaked and e.untargetable_t <= 0.0:
				_damage_enemy(e, dmg, u, {"blast": true})
		_ev({"t": "blast", "pos": u.pos})
	_ev({"t": "merge", "unit": u.id, "slot": slot_b, "from_slot": slot_a, "rank": new_rank, "uid": uid, "lucky": new_rank > a.rank + 1, "failed": new_rank <= a.rank})
	dirty = true
	return u

func _merge_luck_units(owner: int) -> float:
	var best := 0.0
	for u: SimUnit in units:
		if u.owner != owner or u.away_t > 0.0:
			continue
		for t in u.def["traits"]:
			if t["k"] == "merge_luck":
				best += float(t["c"])
	return best

func move_unit(u: SimUnit, to_slot: int) -> bool:
	if u == null or to_slot < 0 or to_slot >= slots.size() or slot_owner(to_slot) != u.owner:
		return false
	var other: SimUnit = slots[to_slot]
	if other == u:
		return false
	var from := u.slot
	if other != null:
		if can_merge(u, other):
			return merge(u, other) != null
		slots[from] = other; other.slot = from
	else:
		slots[from] = null
	slots[to_slot] = u; u.slot = to_slot
	u.pos = slot_pos(to_slot)
	if other != null:
		other.pos = slot_pos(from)
	_ev({"t": "move", "unit": u.id, "slot": to_slot, "other": other.id if other else -1, "from": from})
	dirty = true
	return true

## Single entry point for every player input (local touch, bot, network peer, replay). Returns true if applied.
func apply_action(owner: int, a: Dictionary) -> bool:
	match String(a.get("a", "")):
		"deploy":
			return deploy(owner, int(a.get("slot", -1)), String(a.get("unit", ""))) != null
		"merge":
			var u1 := unit_by_id(int(a.get("u1", -1)))
			var u2 := unit_by_id(int(a.get("u2", -1)))
			if u1 == null or u2 == null or u1.owner != owner:
				return false
			return merge(u1, u2) != null
		"move":
			var u := unit_by_id(int(a.get("u", -1)))
			if u == null or u.owner != owner:
				return false
			return move_unit(u, int(a.get("slot", -1)))
		"sell":
			var u3 := unit_by_id(int(a.get("u", -1)))
			if u3 == null or u3.owner != owner:
				return false
			sell_unit(u3)
			return true
		"choose":
			if state != "offer":
				return false
			choose_offer(int(a.get("i", 0)))
			return true
		"call_wave":
			call_next_wave()
			return true
	return false

func sell_unit(u: SimUnit) -> void:
	if u == null:
		return
	sp += 4.0 * u.rank
	_remove_unit(u)
	_ev({"t": "sell", "pos": u.pos})
	dirty = true

func _remove_unit(u: SimUnit) -> void:
	slots[u.slot] = null
	units.erase(u)
	_ev({"t": "remove", "unit": u.id})

# ================================================================= upgrades / relics
func apply_ops(ops: Array) -> void:
	for op in ops:
		var k: String = op[0]
		match k:
			"tag_dmg", "tag_spd", "tag_crit", "tag_aoe", "tag_sd", "tag_proj":
				var bucket: Dictionary = tag_mods[k.substr(4)]
				bucket[op[1]] = float(bucket.get(op[1], 0.0)) + float(op[2])
			"rar_dmg":
				rar_dmg[op[1]] = float(rar_dmg.get(op[1], 0.0)) + float(op[2])
			"row_dmg", "row_range":
				row_mods.append([k.substr(4), int(op[1]), float(op[2])])
			"col_dmg", "col_spd":
				col_mods.append([k.substr(4), int(op[1]), float(op[2])])
			"rule":
				rules[op[1]] = int(rules.get(op[1], 0)) + 1
				_rule_added(op[1])
			"sp_now":
				sp = maxf(0.0, sp + float(op[1]))
			"city_hp":
				city_max = maxi(1, city_max + int(op[1]))
				city_hp = clampi(city_hp + maxi(0, int(op[1])), 1, city_max)
			"gate":
				mods["gate"] = _m("gate") + float(op[1])
				gates += int(op[1])
			_:
				mods[k] = _m(k) + float(op[1])
	dirty = true

func _rule_added(r: String) -> void:
	match r:
		"gamble":
			var win := rng.randi_range(60, 120)
			sp += win
			_ev({"t": "text", "msg": "+%d SP" % win, "pos": Vector2(540, 900)})
		"second_chance":
			second_chance_used = false

func take_upgrade(id: String) -> void:
	var up: Dictionary = Data.upgrades_by_id[id]
	upgrades_taken[id] = int(upgrades_taken.get(id, 0)) + 1
	apply_ops(up["ops"])
	stats["upgrades"] += 1
	_ev({"t": "upgrade", "id": id})

func _add_relic(id: String, silent: bool = false) -> void:
	if id in relics_owned or not Data.relics_by_id.has(id):
		return
	relics_owned.append(id)
	apply_ops(Data.relics_by_id[id]["ops"])
	if not silent:
		_ev({"t": "relic", "id": id})

# ================================================================= derived stats
func _adjacent(a: SimUnit, b: SimUnit) -> bool:
	var ax := a.slot % cols; var ay := a.slot / cols
	var bx := b.slot % cols; var by := b.slot / cols
	return a != b and absi(ax - bx) <= 1 and absi(ay - by) <= 1

func _recompute() -> void:
	dirty = false
	_recompute_synergies()
	var fill := float(units.size()) / maxf(1.0, float(slots.size()))
	var aura_mult := 1.0 + _m("aura_mult") + float(syn_fx.get("aura_mult", 0.0))
	for u: SimUnit in units:
		var tags: Array = u.def["tags"]
		var dsum := _m("dmg") + float(rar_dmg.get(u.def["rarity"], 0.0)) + float(_unit_dmg_bonus(u.uid))
		var ssum := _m("spd")
		var csum := _m("crit")
		var cm := _m("crit_m")
		var rsum := _m("range")
		var asum := _m("aoe")
		var dur := _m("status_d")
		var proj := 0
		var pierce := _m("pierce")
		var boss := _m("boss")
		var mult := 1.0
		for t in tags:
			dsum += float(tag_mods["dmg"].get(t, 0.0)); ssum += float(tag_mods["spd"].get(t, 0.0))
			csum += float(tag_mods["crit"].get(t, 0.0)); asum += float(tag_mods["aoe"].get(t, 0.0))
			dur += float(tag_mods["sd"].get(t, 0.0)); proj += int(tag_mods["proj"].get(t, 0.0))
		# synergies
		for sf in syn_unit_fx:
			if sf["tag"] in tags:
				var fx: Dictionary = sf["fx"]
				dsum += float(fx.get("tag_dmg", 0.0)); ssum += float(fx.get("tag_spd", 0.0)); asum += float(fx.get("aoe", 0.0))
				dur += float(fx.get("status_d", 0.0)); csum += float(fx.get("crit", 0.0)); pierce += float(fx.get("pierce", 0.0)); boss += float(fx.get("boss", 0.0))
		# position
		var col := u.slot % cols
		var row := u.slot / cols
		for rm in row_mods:
			var r: int = rm[1]
			if r == row or (r < 0 and row == rows + r):
				if rm[0] == "dmg": dsum += rm[2]
				elif rm[0] == "range": rsum += rm[2]
		for cmod in col_mods:
			var c: int = cmod[1]
			var hit := false
			if c >= 0: hit = (col == c)
			elif c == -2: hit = (col == cols / 2)
			elif c == -3: hit = (col == 0 or col == cols - 1)
			if hit:
				if cmod[0] == "dmg": dsum += cmod[2]
				elif cmod[0] == "spd": ssum += cmod[2]
		var adj_n := 0
		var match_n := 0
		for o: SimUnit in units:
			if _adjacent(u, o):
				adj_n += 1
				if o.uid == u.uid:
					match_n += 1
		dsum += _m("adj_dmg") * adj_n + _m("match_dmg") * match_n
		if has_rule("centre_power") and col == cols / 2 and row == rows / 2: dsum += 0.35
		if has_rule("corner_power") and (col == 0 or col == cols - 1) and (row == 0 or row == rows - 1):
			dsum += 0.4; rsum += 0.2
		if has_rule("loner_power") and adj_n == 0: dsum += 0.35
		if has_rule("carpool"): dsum += 0.25 * match_n
		if has_rule("bumper"): ssum += 0.10 * adj_n
		if has_rule("rush_hour"): ssum += 0.65 * fill
		if has_rule("gridlock"): ssum -= 0.15
		if has_rule("one_way"):
			match row % 3:
				0: dsum += 0.25
				1: ssum += 0.25
				2: csum += 0.25
		if has_rule("emergency_lane"):
			mult *= 1.8 if "emergency" in tags else 0.75
		if has_rule("last_stand") and float(city_hp) / float(city_max) < 0.3:
			dsum += 0.4
		if has_rule("black_box"):
			dsum += minf(1.0, 0.25 * synergy_active.size())
		if u.rank >= 5:
			dsum += _m("high_rank_dmg")
		if has_rule("overtime") and "emergency" in tags:
			proj += 1
		if has_rule("glove_box"):
			dsum += 0.30
		if u.merge_haste_t > 0.0:
			ssum += _m("merge_haste")
		ssum += kills_this_wave_spd
		# auras from other vehicles
		for s: SimUnit in units:
			if s == u or s.away_t > 0.0 or s.st.has("silence"):
				continue
			var srank := 1.0 + 0.25 * (s.rank - 1)
			for t in s.def["traits"]:
				match t["k"]:
					"aura_row":
						if s.slot / cols == row:
							dsum += float(t.get("dmg", 0.0)) * aura_mult * srank; ssum += float(t.get("spd", 0.0)) * aura_mult * srank
					"aura_col":
						if s.slot % cols == col:
							dsum += float(t.get("dmg", 0.0)) * aura_mult * srank; ssum += float(t.get("spd", 0.0)) * aura_mult * srank
					"aura_adj":
						if _adjacent(s, u):
							dsum += float(t.get("dmg", 0.0)) * aura_mult * srank; ssum += float(t.get("spd", 0.0)) * aura_mult * srank
					"aura_all":
						dsum += float(t.get("dmg", 0.0)) * aura_mult * srank; ssum += float(t.get("spd", 0.0)) * aura_mult * srank
					"aura_tag":
						if t["tag"] in tags:
							dsum += float(t.get("dmg", 0.0)) * aura_mult * srank; ssum += float(t.get("spd", 0.0)) * aura_mult * srank
		u.dmg_mult = maxf(0.1, 1.0 + dsum) * mult
		u.spd_mult = maxf(0.2, 1.0 + ssum)
		u.crit_c = csum
		u.crit_m = cm
		u.range_mult = 1.0 + rsum
		u.proj_extra = proj
		u.aoe_mult = 1.0 + asum
		u.sd_mult = 1.0 + dur
		u.pierce = clampf(pierce, 0.0, 1.0)
		u.boss_mult = boss

func _unit_dmg_bonus(_uid: String) -> float:
	return 0.0

func _recompute_synergies() -> void:
	synergy_active.clear()
	syn_unit_fx.clear()
	syn_fx = {}
	var tag_counts := {}
	for u: SimUnit in units:
		if u.away_t > 0.0:
			continue
		for t in u.def["tags"]:
			tag_counts[t] = int(tag_counts.get(t, 0)) + 1
	if has_rule("wild_tag") and not tag_counts.is_empty():
		var bt := ""; var bn := 0
		for t in tag_counts:
			if tag_counts[t] > bn:
				bn = tag_counts[t]; bt = t
		tag_counts[bt] += 1
	if has_rule("taxi_plus") and tag_counts.has("taxi"): tag_counts["taxi"] += 1
	if has_rule("vintage_plus") and tag_counts.has("vintage"): tag_counts["vintage"] += 1
	var smult := 1.0 + _m("syn_mult")
	for s in Data.synergies:
		var count := 0
		var tag := ""
		if s.has("tag"):
			tag = s["tag"]; count = int(tag_counts.get(tag, 0))
		else:
			for t in s["mix"]:
				if tag_counts.has(t): count += 1
		var best: Dictionary = {}
		for tier in s["tiers"]:
			if count >= int(tier["n"]):
				best = tier
		if best.is_empty():
			continue
		synergy_active.append({"id": s["id"], "name": best["name"], "desc": best["desc"], "tier": s["tiers"].find(best) + 1, "count": count})
		var fx: Dictionary = {}
		for k in best["fx"]:
			var v = best["fx"][k]
			fx[k] = float(v) * smult if typeof(v) != TYPE_STRING and k not in ["city_regen_waves", "city_hp", "chain_extra"] else v
		var target: String = fx.get("target_tag", tag)
		syn_unit_fx.append({"tag": target, "fx": fx})
		for k in ["sp_wave", "sp_kill", "city_regen_waves", "marked"]:
			if fx.has(k):
				syn_fx[k] = float(syn_fx.get(k, 0.0)) + float(fx[k])
		if fx.has("aura_mult"): syn_fx["aura_mult"] = float(syn_fx.get("aura_mult", 0.0)) + float(fx["aura_mult"])
		if fx.has("chain_extra"): syn_fx["chain_extra"] = int(syn_fx.get("chain_extra", 0)) + int(fx["chain_extra"])
		if fx.has("slow_p"): syn_fx["slow_p"] = float(syn_fx.get("slow_p", 0.0)) + float(fx["slow_p"])
		if fx.has("city_hp") and not misc_timers.has("syn_hp_" + s["id"]):
			misc_timers["syn_hp_" + s["id"]] = true
			city_max += int(fx["city_hp"]); city_hp += int(fx["city_hp"])

# ================================================================= waves
const ENEMY_COST := {"slow_car": 1.0, "speedster": 1.0, "suv": 2.0, "truck": 4.0, "bus": 4.0, "police_chase": 2.0, "gang_cars": 3.0, "motorcycle": 2.0, "armored_truck": 6.0, "road_cleaner": 3.0}
const ENEMY_UNLOCK := {"slow_car": 1, "speedster": 2, "suv": 3, "bus": 4, "gang_cars": 5, "truck": 5, "police_chase": 6, "motorcycle": 7, "road_cleaner": 8, "armored_truck": 9}

func is_boss_wave(w: int) -> bool:
	if tutorial:
		return false
	if total_waves > 0:
		return w == total_waves and cfg.get("boss", "") != ""
	return w % 10 == 0

func boss_id_for(w: int) -> String:
	if total_waves > 0:
		return cfg.get("boss", "monster_truck")
	var order := ["monster_truck", "helicopter", "tank", "drill_truck", "ufo", "mecha"]
	return order[(w / 10 - 1) % order.size()]

func make_wave(w: int) -> Array:
	var spawns: Array = []
	var budget := 6.0 + 3.6 * pow(float(w), 1.06)
	budget *= 1.0 + 0.07 * (chapter_idx - 1)
	if cfg.get("budget_mult", 1.0) != 1.0:
		budget *= float(cfg["budget_mult"])
	var avail: Array = []
	for id in enemy_pool:
		var unlock: int = ENEMY_UNLOCK.get(id, 1)
		unlock = maxi(1, unlock - 2 * (chapter_idx - 1))
		if w >= unlock:
			avail.append(id)
	if avail.is_empty():
		avail = ["slow_car"]
	# themes: pick up to 3 types to emphasise this wave
	var themes: Array = []
	var pool := avail.duplicate()
	for i in mini(3, pool.size()):
		var k := wave_rng.randi() % pool.size()
		themes.append(pool[k]); pool.remove_at(k)
	var t := 0.5
	var spent := 0.0
	var list: Array = []
	var guard := 0
	while spent < budget and guard < 200:
		guard += 1
		var id: String = themes[wave_rng.randi() % themes.size()]
		if wave_rng.randf() < 0.18 and avail.size() > 0:
			id = avail[wave_rng.randi() % avail.size()]
		var cost: float = ENEMY_COST.get(id, 1.0)
		if spent + cost > budget * 1.15 and spent > 0.0:
			break
		spent += cost
		list.append(id)
	# very dense waves are condensed into fewer, tougher vehicles so a wave never drags on
	var hpm := 1
	if list.size() > 26:
		hpm = int(ceil(list.size() / 26.0))
		var cond: Array = []
		var i := 0
		while i < list.size():
			cond.append(list[i])
			i += hpm
		list = cond
	var n := list.size()
	var dur := clampf(4.0 + n * 0.42, 6.0, 15.0)
	var step := dur / maxf(1.0, float(n))
	for id in list:
		var pack: int = int(Data.enemies[id].get("pack", 1))
		var espd: float = float(Data.enemies[id]["speed"]) * SPEED_SCALE * (1.0 + 0.012 * minf(w, 30))
		var gap := 92.0 / maxf(espd, 40.0)
		for p in pack:
			spawns.append({"t": t + p * gap, "id": id, "elite": false, "boss": false, "hpm": hpm})
		t += maxf(step * wave_rng.randf_range(0.7, 1.3), gap * (float(pack) + 0.3))
	# elites
	if w % 5 == 0 and not tutorial:
		var ne := 1 + w / 15
		for i in ne:
			var id: String = avail[wave_rng.randi() % avail.size()]
			spawns.append({"t": 3.0 + i * 2.5, "id": id, "elite": true, "boss": false})
	if is_boss_wave(w):
		spawns.append({"t": 2.0, "id": boss_id_for(w), "elite": false, "boss": true})
	spawns.sort_custom(func(a, b): return a["t"] < b["t"])
	return spawns

func _start_wave() -> void:
	wave += 1
	state = "wave"
	wave_clock = 0.0
	wave_spawn_left = make_wave(wave)
	wave_total_enemies = wave_spawn_left.size()
	wave_kills = 0
	kills_this_wave_spd = 0.0
	wave_free_used = false
	gates = int(_m("gate"))
	for u: SimUnit in units:
		for t in u.def["traits"]:
			if t["k"] == "gate":
				gates += int(t["n"])
	# per-wave income
	var swave := _m("sp_wave") + float(syn_fx.get("sp_wave", 0.0))
	for u: SimUnit in units:
		for t in u.def["traits"]:
			if t["k"] == "sp_wave":
				swave += float(t["n"])
	sp += swave
	if swave > 0:
		_ev({"t": "sp", "amt": swave, "pos": Vector2(540, 1560)})
	if _m("city_regen") > 0:
		_heal_city(int(_m("city_regen")))
	var rw := int(syn_fx.get("city_regen_waves", 0.0))
	if rw > 0 and wave % rw == 0:
		_heal_city(1)
	if _m("deploy_reset") > 0:
		deploy_count = maxi(0, deploy_count - int(_m("deploy_reset")))
	if has_rule("boss_prep") and is_boss_wave(wave):
		sp += 25
		for u: SimUnit in units:
			u.st["shield"] = {"t": 20.0, "p": 1.0}
	if has_rule("boss_horn") and is_boss_wave(wave):
		misc_timers["horn"] = 2.0
	_ev({"t": "wave_start", "wave": wave, "boss": is_boss_wave(wave), "elite": wave % 5 == 0 and not tutorial, "total": total_waves, "count": wave_total_enemies})

func _heal_city(n: int) -> void:
	var before := city_hp
	city_hp = mini(city_max, city_hp + n)
	if city_hp != before:
		_ev({"t": "heal", "amt": city_hp - before})

func _spawn_enemy(id: String, elite: bool, boss: bool, pos_prog: float = 0.0, from_split: bool = false, hpm: int = 1) -> SimEnemy:
	var e := SimEnemy.new()
	e.id = next_id; next_id += 1
	e.eid = id
	e.boss = boss
	e.def = Data.bosses[id] if boss else Data.enemies[id]
	var scale := hp_scale(maxi(1, wave))
	if from_split:
		scale *= 0.6
	var hp := float(e.def["hp"]) * scale * float(hpm)
	e.sp_mult = float(hpm)
	if hpm > 1:
		e.size_mult = 1.0 + 0.08 * (hpm - 1)
	if boss:
		hp = float(e.def["hp"]) * hp_scale(maxi(1, wave)) * 0.7
	if elite:
		hp *= 3.4
		e.shield = hp * 0.2
	e.elite = elite
	e.max_hp = hp; e.hp = hp
	var spd_mult := 1.0 + enemy_speed_mult_extra + _m("enemy_fast") - _m("enemy_slow")
	if has_rule("gridlock"):
		spd_mult -= 0.40
	e.speed = float(e.def["speed"]) * SPEED_SCALE * maxf(0.3, spd_mult) * (1.0 + 0.012 * minf(wave, 30))
	e.armor = clampf(float(e.def.get("armor", 0.0)) + (0.1 if elite else 0.0), 0.0, 0.85)
	e.sp = float(e.def["sp"]) * (4.0 if elite else 1.0) * sqrt(float(hpm))
	e.leak = int(e.def["leak"]) * (2 if elite else 1)
	e.flying = bool(e.def.get("flying", false))
	e.progress = pos_prog
	e.spawn_t = time
	if boss:
		for ab in e.def.get("abilities", []):
			e.timers[ab["k"]] = float(ab["every"])
		boss_alive = true
		stats["bosses"] += 1
	if elite:
		stats["elites"] += 1
	enemies.append(e)
	_update_enemy_pos(e)
	_ev({"t": "spawn", "enemy": e.id, "boss": boss, "elite": elite})
	return e

func inject_enemy(id: String, count: int = 1) -> void:
	for i in count:
		sent_queue.append(id)

func _update_enemy_pos(e: SimEnemy) -> void:
	if e.flying:
		var f := clampf(e.progress / maxf(1.0, path_len * 0.62), 0.0, 1.0)
		e.pos = path_pts[0].lerp(Vector2(1150, 790), f)
		e.dir = (Vector2(1150, 790) - path_pts[0]).normalized()
	else:
		e.pos = path_pos(e.progress)
		e.dir = path_dir(e.progress)

func enemy_end_len(e: SimEnemy) -> float:
	return path_len * (0.62 if e.flying else 1.0)

# ================================================================= main tick
func tick(dt: float) -> void:
	if state == "ended" or state == "offer":
		return
	dt = minf(dt, 0.1)
	time += dt
	recompute_t -= dt
	if dirty or recompute_t <= 0.0:
		_recompute(); recompute_t = 0.25
	_update_wave(dt)
	_update_enemies(dt)
	_update_units(dt)
	_update_pending(dt)
	_update_hazards(dt)
	_update_rules(dt)
	_flush_sent(dt)
	_cleanup_dead()
	if city_hp <= 0 and state != "ended":
		if has_rule("second_chance") and not second_chance_used:
			second_chance_used = true
			city_hp = maxi(1, city_max / 2)
			_ev({"t": "text", "msg": "SECOND CHANCE!", "pos": Vector2(540, 700)})
		else:
			_finish("defeat")

func _finish(res: String) -> void:
	if state == "ended":
		return
	state = "ended"
	result = res
	_ev({"t": "end", "result": res})
	ended.emit(res)

func _cleanup_dead() -> void:
	var i := enemies.size() - 1
	while i >= 0:
		if not enemies[i].alive:
			enemies.remove_at(i)
		i -= 1

func _update_wave(dt: float) -> void:
	match state:
		"countdown":
			wave_timer -= dt
			if wave_timer <= 0.0 and not (total_waves > 0 and wave >= total_waves):
				_start_wave()
		"wave":
			wave_clock += dt
			while not wave_spawn_left.is_empty() and wave_spawn_left[0]["t"] <= wave_clock:
				var s: Dictionary = wave_spawn_left.pop_front()
				_spawn_enemy(s["id"], s["elite"], s["boss"], 0.0, false, int(s.get("hpm", 1)))
			if wave_spawn_left.is_empty() and (enemies.is_empty() or wave_clock >= 22.0 + 0.25 * wave):
				_end_wave()
	if state == "countdown" and total_waves > 0 and wave >= total_waves and enemies.is_empty() and wave_spawn_left.is_empty():
		_finish("victory")

func call_next_wave() -> void:
	if state == "countdown" and wave_timer > 0.5:
		var bonus := wave_timer * 1.5
		sp += bonus
		_ev({"t": "sp", "amt": bonus, "pos": Vector2(540, 1560)})
		wave_timer = 0.0

func _end_wave() -> void:
	state = "countdown"
	wave_timer = 3.0 if tutorial else 4.0
	var bonus := (14.0 + 3.0 * wave) * (1.0 + _m("clear_bonus"))
	if enemies.is_empty():
		sp += bonus
		_ev({"t": "sp", "amt": bonus, "pos": Vector2(540, 1560)})
	_ev({"t": "wave_clear", "wave": wave, "bonus": bonus})
	if no_upgrades or (tutorial and wave != 1):
		return
	# offers
	var queue: Array = []
	if wave >= next_offer_wave or (tutorial and wave == 1):
		queue.append("upgrade")
		next_offer_wave = wave + 3
	if (wave % 5 == 0 or (is_boss_wave(wave) and total_waves > 0)) and not tutorial:
		queue.append("relic")
	if has_rule("boss_cache") and is_boss_wave(wave):
		queue.append("relic")
	if not queue.is_empty():
		misc_timers["offer_queue"] = queue
		_next_offer()

func _next_offer() -> void:
	var q: Array = misc_timers.get("offer_queue", [])
	if q.is_empty():
		if state == "offer":
			state = "countdown"
		return
	var kind: String = q.pop_front()
	misc_timers["offer_queue"] = q
	offer_kind = kind
	offer = roll_upgrade_offer() if kind == "upgrade" else roll_relic_offer()
	if offer.is_empty():
		_next_offer()
		return
	state = "offer"
	_ev({"t": "offer", "kind": kind})

func choose_offer(i: int) -> void:
	if state != "offer" or i < 0 or i >= offer.size():
		return
	var o: Dictionary = offer[i]
	if offer_kind == "upgrade":
		take_upgrade(o["id"])
	else:
		_add_relic(o["id"])
	offer = []
	state = "countdown"
	_next_offer()

func reroll_offer() -> bool:
	if state != "offer" or sp < 25:
		return false
	sp -= 25
	offer = roll_upgrade_offer() if offer_kind == "upgrade" else roll_relic_offer()
	return true

func skip_offer_for_sp() -> void:
	if state != "offer":
		return
	sp += 20
	offer = []
	state = "countdown"
	_next_offer()

# ================================================================= enemies
func _update_enemies(dt: float) -> void:
	var horn: float = misc_timers.get("horn", 0.0)
	if horn > 0.0:
		misc_timers["horn"] = horn - dt
	for e: SimEnemy in enemies:
		if not e.alive:
			continue
		# status ticking
		var burn_dps := 0.0
		for k in e.st.keys():
			var s: Dictionary = e.st[k]
			s["t"] = float(s["t"]) - dt
			if k == "burn":
				burn_dps = float(s["p"])
			if s["t"] <= 0.0:
				e.st.erase(k)
		if burn_dps > 0.0:
			var mult := 1.0 + _m("burn_dmg")
			if e.st.has("oil"):
				mult *= 1.6
			_damage_enemy(e, burn_dps * mult * dt, null, {"burn": true, "true": true})
			if not e.alive:
				continue
		if horn > 0.0 and not e.boss:
			e.st["fear"] = {"t": 2.0, "p": 1.0}
		e.untargetable_t = maxf(0.0, e.untargetable_t - dt)
		# aura / ability timers
		_enemy_abilities(e, dt)
		if e.st.has("stun"):
			continue
		var f := 1.0
		if e.st.has("slow"):
			f *= maxf(0.15, 1.0 - float(e.st["slow"]["p"]))
		if e.st.has("oil"):
			f *= 1.25
		if e.st.has("haste"):
			f *= 1.3
		if e.boss:
			f *= 1.0 - _m("boss_slow")
		if e.phase >= 3:
			f *= 1.4
		for h in hazards:
			if absf(e.progress - float(h["prog"])) < float(h["r"]):
				f *= 1.0 - float(h["slow"])
		if e.st.has("fear"):
			e.progress = maxf(0.0, e.progress - e.speed * 0.8 * dt)
		else:
			e.progress += e.speed * f * dt
		_update_enemy_pos(e)
		if e.progress >= enemy_end_len(e):
			_leak(e)

func _enemy_abilities(e: SimEnemy, dt: float) -> void:
	var d: Dictionary = e.def
	if d.has("haste_aura"):
		var t: float = float(e.timers.get("aura", 0.0)) - dt
		if t <= 0.0:
			t = 0.5
			for o: SimEnemy in enemies:
				if o != e and o.alive and o.pos.distance_to(e.pos) < float(d["aura_r"]):
					o.st["haste"] = {"t": 0.8, "p": float(d["haste_aura"])}
		e.timers["aura"] = t
	if d.has("cleanse_aura"):
		var t2: float = float(e.timers.get("cl", float(d["cleanse_aura"]))) - dt
		if t2 <= 0.0:
			t2 = float(d["cleanse_aura"])
			for o: SimEnemy in enemies:
				if o.alive and o.pos.distance_to(e.pos) < float(d["aura_r"]):
					for k in ["slow", "burn", "stun", "marked", "armor_break", "shock", "wet", "oil", "fear"]:
						o.st.erase(k)
			_ev({"t": "cleanse_fx", "pos": e.pos})
		e.timers["cl"] = t2
	if not e.boss:
		return
	# boss phases (mecha)
	if d.get("phases", false):
		var frac := e.hp / e.max_hp
		if e.phase == 0 and frac < 0.7:
			e.phase = 1; e.shield = e.max_hp * 0.14
			_ev({"t": "boss_phase", "phase": 1, "enemy": e.id})
		elif e.phase == 1 and frac < 0.35:
			e.phase = 2
			for i in 4:
				_spawn_enemy("speedster", false, false, maxf(0.0, e.progress - 30.0 * i), true)
			_ev({"t": "boss_phase", "phase": 2, "enemy": e.id})
		elif e.phase == 2 and frac < 0.2:
			e.phase = 3
			_ev({"t": "boss_phase", "phase": 3, "enemy": e.id})
	for ab in d.get("abilities", []):
		var k: String = ab["k"]
		var t3: float = float(e.timers.get(k, float(ab["every"]))) - dt
		if t3 > 0.0:
			e.timers[k] = t3
			continue
		e.timers[k] = float(ab["every"]) * (0.7 if e.phase >= 3 else 1.0)
		var live: Array = units.filter(func(x): return x.away_t <= 0.0)
		match k:
			"stomp":
				if not live.is_empty():
					var u: SimUnit = live[rng.randi() % live.size()]
					_unit_debuff(u, "stun", float(ab["d"]))
					_ev({"t": "boss_fx", "k": "stomp", "pos": u.pos, "from": e.pos})
			"bomb":
				for i in int(ab.get("n", 2)):
					if live.is_empty(): break
					var u2: SimUnit = live[rng.randi() % live.size()]
					_unit_debuff(u2, "jammed", float(ab["d"]))
					_ev({"t": "boss_fx", "k": "bomb", "pos": u2.pos, "from": e.pos})
			"shell":
				if not live.is_empty():
					var u3: SimUnit = live[rng.randi() % live.size()]
					_unit_debuff(u3, "silence", float(ab["d"]))
					_ev({"t": "boss_fx", "k": "shell", "pos": u3.pos, "from": e.pos})
			"burrow":
				e.untargetable_t = float(ab["d"])
				e.timers["jump_pending"] = float(ab["d"])
				_ev({"t": "boss_fx", "k": "burrow", "pos": e.pos, "from": e.pos})
				e.progress += float(ab["jump"])
				_update_enemy_pos(e)
			"abduct":
				if not live.is_empty():
					var u4: SimUnit = live[rng.randi() % live.size()]
					u4.away_t = float(ab["d"])
					_ev({"t": "boss_fx", "k": "abduct", "pos": u4.pos, "from": e.pos, "unit": u4.id})
					dirty = true

func _unit_debuff(u: SimUnit, st: String, d: float) -> void:
	if has_rule("hazard_lights") and wave_clock < 6.0 and st in ["jammed", "silence"]:
		return
	if u.st.has("shield"):
		u.st.erase("shield")
		_ev({"t": "shield_pop", "pos": u.pos})
		return
	u.st[st] = {"t": d, "p": 1.0}
	_ev({"t": "debuff", "unit": u.id, "st": st})

func _leak(e: SimEnemy) -> void:
	e.alive = false; e.leaked = true
	if e.boss:
		boss_alive = false
	var dmg := maxi(1, int(round(float(e.leak) * (1.0 - _m("leak_red"))))) + int(_m("leak_extra"))
	if gates > 0:
		gates -= 1
		_ev({"t": "block", "pos": e.pos})
	else:
		city_hp -= dmg
		stats["leaks"] += 1
		_ev({"t": "leak", "dmg": dmg, "pos": e.pos, "enemy": e.id})
	if has_rule("toll_gate"):
		sp += e.sp * 0.5

func _flush_sent(dt: float) -> void:
	if sent_queue.is_empty():
		return
	var t: float = float(misc_timers.get("sent_t", 0.0)) - dt
	if t <= 0.0:
		t = 0.45
		var id: String = sent_queue.pop_front()
		var e := _spawn_enemy(id, false, false, 0.0)
		e.sent = true
	misc_timers["sent_t"] = t

# ================================================================= damage / status
func _armor_eff(e: SimEnemy, pierce: float) -> float:
	var a := e.armor
	if e.st.has("armor_break"):
		a *= 0.5
	return clampf(a * (1.0 - clampf(pierce, 0.0, 1.0)), 0.0, 0.9)

func _damage_enemy(e: SimEnemy, amount: float, src: SimUnit, flags: Dictionary = {}) -> float:
	if not e.alive or e.untargetable_t > 0.0 and not flags.get("true", false):
		return 0.0
	var dmg := amount
	if not flags.get("true", false):
		dmg *= 1.0 - _armor_eff(e, float(flags.get("pierce", 0.0)))
	if e.shield > 0.0:
		var ab := minf(e.shield, dmg)
		e.shield -= ab; dmg -= ab
	e.hp -= dmg
	e.hits += 1
	if src != null:
		src.dmg_done += amount
		stats["damage"] += int(amount)
	if flags.get("show", false) and amount > 0.0:
		_ev({"t": "hit", "pos": e.pos, "dmg": amount, "crit": flags.get("crit", false), "enemy": e.id, "elem": flags.get("elem", "")})
	if e.hp <= 0.0:
		_kill(e, src)
	return dmg

func apply_enemy_status(e: SimEnemy, st: String, d: float, p: float = 1.0) -> void:
	if not e.alive:
		return
	if e.boss and st in ["fear", "stun"]:
		if st == "fear":
			return
		d *= 0.4
	elif e.elite and st in ["stun", "fear"]:
		d *= 0.6
	if st == "wet":
		e.st.erase("burn")
	if st == "burn" and e.st.has("wet") and not e.st.has("oil"):
		return
	if e.st.has(st):
		e.st[st]["t"] = maxf(e.st[st]["t"], d); e.st[st]["p"] = maxf(e.st[st]["p"], p)
	else:
		e.st[st] = {"t": d, "p": p}
		_ev({"t": "status", "enemy": e.id, "st": st, "pos": e.pos})

func push_enemy(e: SimEnemy, d: float) -> void:
	if not e.alive:
		return
	if bool(e.def.get("immune_push", false)):
		d *= 0.25
	e.progress = maxf(0.0, e.progress - d * (1.0 + _m("push")))
	_update_enemy_pos(e)
	_ev({"t": "push", "enemy": e.id, "pos": e.pos})

func _kill(e: SimEnemy, src: SimUnit) -> void:
	if not e.alive:
		return
	e.alive = false
	e.hp = 0.0
	if e.boss:
		boss_alive = false
	kill_count += 1
	stats["kills"] += 1
	wave_kills += 1
	var gain := e.sp * SP_SCALE * (1.0 + _m("sp_kill") + float(syn_fx.get("sp_kill", 0.0))) + _m("sp_flat")
	if e.elite or e.boss:
		gain *= 1.0 + _m("elite_sp")
	if e.boss:
		gain += _m("boss_sp")
	if src != null:
		src.kills += 1
		for t in src.def["traits"]:
			if t["k"] == "sp_kill":
				gain += float(t["n"])
	if rng.randf() < _m("sp_chance"):
		gain += 3.0 if not has_rule("lottery") else 15.0
	if has_rule("jackpot") and kill_count % 25 == 0:
		gain += 25.0; free_deploys += 1
		_ev({"t": "text", "msg": "JACKPOT!", "pos": e.pos})
	var owner := src.owner if src != null else 0
	if owner == 0 or not coop:
		sp += gain
	else:
		sp_partner += gain
	stats["sp_earned"] += int(gain)
	kills_this_wave_spd = minf(0.30, kills_this_wave_spd + _m("kill_spd")) if _m("kill_spd") > 0.0 else 0.0
	if e.def.has("split"):
		for i in int(e.def.get("split_n", 2)):
			_spawn_enemy(e.def["split"], false, false, maxf(0.0, e.progress - 18.0 * i - 8.0), true)
	if has_rule("contagion"):
		for o: SimEnemy in enemies:
			if o.alive and o != e and o.pos.distance_to(e.pos) < 150.0:
				for k in e.st:
					if k in ["burn", "wet", "shock", "slow", "marked", "oil"]:
						apply_enemy_status(o, k, e.st[k]["t"], e.st[k]["p"])
	_ev({"t": "kill", "pos": e.pos, "enemy": e.id, "eid": e.eid, "boss": e.boss, "elite": e.elite, "sp": gain, "dir": e.dir})
	kill_hook.call(e) if kill_hook.is_valid() else null

var kill_hook: Callable = Callable()

# ================================================================= units
func _update_units(dt: float) -> void:
	for u: SimUnit in units:
		var dirty_st := false
		for k in u.st.keys():
			u.st[k]["t"] = float(u.st[k]["t"]) - dt
			if u.st[k]["t"] <= 0.0:
				u.st.erase(k); dirty_st = true
		if u.merge_haste_t > 0.0:
			u.merge_haste_t -= dt
			if u.merge_haste_t <= 0.0:
				dirty = true
		if u.away_t > 0.0:
			u.away_t -= dt
			if u.away_t <= 0.0:
				_ev({"t": "returned", "unit": u.id}); dirty = true
				u.st["fear"] = {"t": 1.0, "p": 1.0}
			continue
		if u.st.has("stun"):
			continue
		_unit_timers(u, dt)
		var f := u.spd_mult
		if u.st.has("jammed"):
			f *= 0.5
		if u.st.has("haste"):
			f *= 1.3
		f *= 1.0 + u.ramp
		u.cd -= dt * f
		if u.cd <= 0.0:
			var tl := _targets(u, _shots_for(u))
			if not tl.is_empty():
				_attack(u, tl)
				u.cd = maxf(u.cd, -0.05) + unit_interval(u)
			else:
				u.cd = 0.0
				u.ramp = maxf(0.0, u.ramp - dt * 0.5)

func _shots_for(u: SimUnit) -> int:
	var n := 1
	for t in u.def["traits"]:
		if t["k"] == "multi":
			n = int(t["n"]) + int(_m("proj"))
		elif t["k"] == "rank_proj":
			for r in t["ranks"]:
				if u.rank >= int(r):
					n += 1
	n += u.proj_extra
	return n

func _unit_timers(u: SimUnit, dt: float) -> void:
	if u.st.has("silence"):
		return
	for k in u.timers.keys():
		var t := float(u.timers[k]) - dt
		if t > 0.0:
			u.timers[k] = t
			continue
		var tr: Dictionary = {}
		for x in u.def["traits"]:
			if x["k"] == k:
				tr = x
		u.timers[k] = float(tr.get("every", 8.0))
		match k:
			"heal_city":
				_heal_city(int(tr.get("n", 1)))
				_ev({"t": "ability", "unit": u.id, "name": "heal"})
			"shield_ally":
				var c: Array = units.filter(func(x): return x != u and x.owner == u.owner and not x.st.has("shield") and x.away_t <= 0.0)
				if not c.is_empty():
					var v: SimUnit = c[rng.randi() % c.size()]
					v.st["shield"] = {"t": 12.0, "p": 1.0}
					_ev({"t": "ability", "unit": u.id, "name": "shield", "target": v.id})
			"cleanse":
				for x: SimUnit in units:
					if _adjacent(u, x) or x.slot / cols == u.slot / cols:
						for s in ["jammed", "silence", "stun", "fear"]:
							x.st.erase(s)
				_ev({"t": "ability", "unit": u.id, "name": "cleanse"})
			"stun_pulse":
				var rng_px := float(tr.get("r", 520.0)) * u.range_mult
				var hit := 0
				for e: SimEnemy in enemies:
					if e.alive and e.pos.distance_to(u.pos) <= rng_px and not e.flying:
						apply_enemy_status(e, "stun", float(tr["d"]) * u.sd_mult)
						hit += 1
				if hit > 0:
					_ev({"t": "ability", "unit": u.id, "name": "stun_pulse"})
			"cone":
				var lead := _lead_enemy()
				var prog := (lead.progress + 90.0) if lead != null else 300.0
				var dur := float(tr["d"]) * (2.0 if has_rule("lucky_cone") else 1.0)
				hazards.append({"prog": prog, "t": dur, "r": 75.0, "slow": 0.4 + (0.25 if has_rule("lucky_cone") else 0.0), "src": u.id})
				_ev({"t": "cone", "pos": path_pos(prog), "dur": dur, "unit": u.id})
			"pulse":
				var dmg := unit_base_dmg(u) * u.dmg_mult * float(tr["m"])
				for e: SimEnemy in enemies:
					if e.alive and not e.flying and e.untargetable_t <= 0.0:
						_damage_enemy(e, dmg, u, {"show": true, "pierce": u.pierce, "elem": "pulse"})
				_ev({"t": "pulse", "unit": u.id, "pos": u.pos})
			"abduct":
				var best: SimEnemy = null
				for e: SimEnemy in enemies:
					if e.alive and not e.boss and not e.flying and (best == null or e.hp > best.hp):
						best = e
				if best != null:
					best.progress = 0.0
					apply_enemy_status(best, "stun", 1.2)
					_update_enemy_pos(best)
					_ev({"t": "ability", "unit": u.id, "name": "abduct", "pos": best.pos})

func _lead_enemy() -> SimEnemy:
	var best: SimEnemy = null
	for e: SimEnemy in enemies:
		if e.alive and not e.flying and (best == null or e.progress > best.progress):
			best = e
	return best

func _targets(u: SimUnit, n: int) -> Array:
	var r := float(u.def["range"]) * u.range_mult
	var r2 := r * r
	var cand: Array = []
	for e: SimEnemy in enemies:
		if not e.alive or e.untargetable_t > 0.0 or e.leaked:
			continue
		if e.pos.x < -40.0 or e.pos.x > FIELD_W + 40.0:
			continue
		if e.pos.distance_squared_to(u.pos) <= r2:
			cand.append(e)
	if cand.is_empty():
		return cand
	var mode: String = u.def["target"]
	var upos := u.pos
	cand.sort_custom(_target_less.bind(mode, upos))
	if mode == "random":
		cand.shuffle()
	if n <= 1:
		return [cand[0]]
	return cand.slice(0, n)

func _target_less(a: SimEnemy, b: SimEnemy, mode: String, upos: Vector2) -> bool:
	match mode:
		"last":
			return a.progress < b.progress
		"strong":
			return a.hp > b.hp
		"weak":
			return a.hp < b.hp
		"near":
			return a.pos.distance_squared_to(upos) < b.pos.distance_squared_to(upos)
		"fast":
			return a.speed > b.speed
		"marked":
			var am: bool = a.st.has("marked")
			var bm: bool = b.st.has("marked")
			if am != bm:
				return am
			return a.progress > b.progress
		"random":
			return a.id < b.id
	return a.progress > b.progress

func _attack(u: SimUnit, tl: Array) -> void:
	u.shots += 1
	var first: SimEnemy = tl[0]
	# ramp
	for t in u.def["traits"]:
		if t["k"] == "ramp":
			if u.last_target == first.id:
				u.ramp = minf(float(t["max"]), u.ramp + float(t["per"]))
			else:
				u.ramp = 0.0
	u.last_target = first.id
	var kind: String = u.def["proj"]
	var tposes: Array = []
	for e in tl:
		_fire(u, e, 1.0, kind)
		tposes.append(e.pos)
	_ev({"t": "shoot", "unit": u.id, "targets": tposes, "kind": kind, "pos": u.pos})
	var dup_c := _m("dup")
	for t in u.def["traits"]:
		if t["k"] == "dup":
			dup_c += float(t["c"])
	if dup_c > 0.0 and rng.randf() < dup_c:
		for e in tl:
			_fire(u, e, 1.0, kind, 0.12)
		_ev({"t": "echo", "unit": u.id})
	for t in u.def["traits"]:
		if t["k"] == "portal" and rng.randf() < float(t["c"]):
			var live: Array = enemies.filter(func(x): return x.alive and not x.flying and x.untargetable_t <= 0.0)
			if not live.is_empty():
				var e2: SimEnemy = live[rng.randi() % live.size()]
				_fire(u, e2, float(t["m"]), "bolt", 0.05)
				_ev({"t": "portal", "pos": e2.pos, "unit": u.id})
	if has_rule("shockwave") and u.shots % 8 == 0:
		var dmg := unit_base_dmg(u) * u.dmg_mult
		var r := float(u.def["range"]) * u.range_mult
		for e: SimEnemy in enemies:
			if e.alive and not e.flying and e.untargetable_t <= 0.0 and e.pos.distance_to(u.pos) <= r:
				_damage_enemy(e, dmg, u, {"show": true, "pierce": u.pierce})
		_ev({"t": "shockwave", "pos": u.pos, "r": r})

const PROJ_SPEED := {"bullet": 1500.0, "lob": 1000.0, "bolt": 4000.0, "beam": 6000.0, "wave": 1300.0}

func _fire(u: SimUnit, e: SimEnemy, mult: float, kind: String, delay: float = 0.0) -> void:
	var dist := u.pos.distance_to(e.pos)
	var spd: float = float(PROJ_SPEED.get(kind, 1500.0)) * (1.0 + _m("proj_speed"))
	pending.append({"t": delay + dist / spd, "u": u, "e": e.id, "pos": e.pos, "mult": mult, "kind": kind, "start": u.pos})

func _update_pending(dt: float) -> void:
	var i := pending.size() - 1
	var due: Array = []
	while i >= 0:
		pending[i]["t"] = float(pending[i]["t"]) - dt
		if pending[i]["t"] <= 0.0:
			due.append(pending[i])
			pending.remove_at(i)
		i -= 1
	due.reverse()
	for p in due:
		_resolve(p)

func _resolve(p: Dictionary) -> void:
	var u: SimUnit = p["u"]
	var e: SimEnemy = enemy_by_id(int(p["e"]))
	var kind: String = p["kind"]
	var hit_pos: Vector2 = p["pos"]
	var direct := e != null and e.alive and e.untargetable_t <= 0.0
	if direct:
		hit_pos = e.pos
	elif kind != "lob" and kind != "wave":
		return
	var mult: float = p["mult"]
	var elem := "bolt" if kind in ["bolt", "beam"] else ""
	if direct:
		_hit_enemy(u, e, mult, {"elem": elem, "show": true, "kind": kind})
	for t in u.def["traits"]:
		match t["k"]:
			"splash":
				var r: float = float(t["r"]) * u.aoe_mult * (1.0 + 0.0)
				var pct: float = float(t["pct"]) * (1.0 + _m("splash_pct"))
				var times := 2 if has_rule("double_splash") else 1
				for rep in times:
					for o: SimEnemy in enemies:
						if not o.alive or o.untargetable_t > 0.0 or o == e or o.flying != (e.flying if e != null else false):
							continue
						if o.pos.distance_to(hit_pos) <= r:
							_hit_enemy(u, o, mult * pct * (0.5 if rep == 1 else 1.0), {"splash": true, "show": true, "elem": "splash"})
					if direct and t.has("st"):
						apply_enemy_status(e, t["st"], float(t.get("sd", 3.0)) * u.sd_mult, _status_power(u, t["st"]))
				if t.has("st"):
					for o2: SimEnemy in enemies:
						if o2.alive and o2 != e and o2.pos.distance_to(hit_pos) <= r:
							apply_enemy_status(o2, t["st"], float(t.get("sd", 3.0)) * u.sd_mult, _status_power(u, t["st"]))
				_ev({"t": "splash", "pos": hit_pos, "r": r, "st": t.get("st", ""), "unit": u.id})
			"push":
				var r2 := float(t.get("r", 0.0))
				if r2 > 0.0:
					for o: SimEnemy in enemies:
						if o.alive and o.pos.distance_to(hit_pos) <= r2 * u.aoe_mult:
							push_enemy(o, float(t["d"]))
				elif direct:
					push_enemy(e, float(t["d"]))
	if kind == "lob" and _m("lob_extra") > 0.0:
		for i in int(_m("lob_extra")):
			var ang := rng.randf() * TAU
			var q := hit_pos + Vector2(cos(ang), sin(ang)) * rng.randf_range(40.0, 90.0)
			for o: SimEnemy in enemies:
				if o.alive and o.pos.distance_to(q) <= 55.0:
					_hit_enemy(u, o, mult * 0.35, {"splash": true, "show": true})
			_ev({"t": "splash", "pos": q, "r": 55.0, "st": "", "unit": u.id})

func _status_power(u: SimUnit, st: String) -> float:
	match st:
		"burn": return unit_base_dmg(u) * u.dmg_mult * 0.45
		"slow": return 0.35 + _m("slow_p") + float(syn_fx.get("slow_p", 0.0))
		_: return 1.0

func _hit_enemy(u: SimUnit, e: SimEnemy, mult: float, flags: Dictionary) -> void:
	if not e.alive or e.untargetable_t > 0.0:
		return
	var d: Dictionary = e.def
	if d.has("dodge") and rng.randf() < float(d["dodge"]):
		_ev({"t": "miss", "pos": e.pos})
		return
	var dmg := unit_base_dmg(u) * u.dmg_mult * mult
	var tr_pierce := u.pierce
	var crit_c := u.crit_c
	var crit_m := 2.0 + u.crit_m
	var boss_m := 1.0 + _m("boss") + u.boss_mult
	var oil_burn := false
	var fast_m := 1.0
	var statuses: Array = []
	for t in u.def["traits"]:
		match t["k"]:
			"crit":
				crit_c += float(t["c"]); crit_m = maxf(crit_m, float(t["m"]) + u.crit_m)
			"pierce_armor":
				tr_pierce = maxf(tr_pierce, float(t["pct"]))
			"boss":
				boss_m *= float(t["m"])
			"fast_bonus":
				if e.speed >= float(t["spd"]):
					fast_m = float(t["m"])
			"oil_burn":
				oil_burn = true
			"status", "stun_hit", "fear", "mark_fast", "pull", "strip":
				statuses.append(t)
	if u.crit_ready:
		crit_c = 1.0; u.crit_ready = false
	var crit := rng.randf() < crit_c
	if crit:
		dmg *= crit_m
		stats["crits"] += 1
		if rng.randf() < _m("crit_sp"):
			sp += 1.0
		if has_rule("crit_chain"):
			u.crit_ready = true
	if e.boss or e.elite:
		dmg *= boss_m
	dmg *= fast_m
	if e.hp >= e.max_hp * 0.99:
		dmg *= 1.0 + _m("first_hit")
	if e.hp <= e.max_hp * 0.3:
		dmg *= 1.0 + _m("exec")
	if e.st.has("marked"):
		var mm := 1.30 + _m("marked") + float(syn_fx.get("marked", 0.0))
		if "police" in u.def["tags"]:
			mm += 0.20
		dmg *= mm
	var elec: bool = flags.get("elem", "") == "bolt" or "electric" in u.def["tags"] or "ev" in u.def["tags"]
	if elec and e.st.has("wet"):
		dmg *= 1.5
	if elec and e.st.has("shock"):
		dmg *= 1.25
	if has_rule("giant_slayer"):
		dmg *= 1.0 + minf(0.6, 0.03 * e.max_hp / 100.0)
	if has_rule("weak_point") and e.boss:
		var rs := 0
		for x: SimUnit in units:
			rs += x.rank
		dmg *= 1.0 + minf(0.4, 0.04 * rs)
	if oil_burn and e.st.has("burn") and e.st.has("oil"):
		dmg *= 1.5
	var fl := {"show": flags.get("show", false), "crit": crit, "pierce": tr_pierce, "elem": flags.get("elem", "")}
	if _m("exec_kill") > 0.0 and e.hp - dmg <= e.max_hp * _m("exec_kill") and not e.boss:
		dmg = maxf(dmg, e.hp + 1.0)
	_damage_enemy(e, dmg, u, fl)
	if not e.alive:
		return
	# on-hit statuses
	for t in statuses:
		match t["k"]:
			"status":
				var c := float(t["c"]) + _m("status_c")
				if rng.randf() < c:
					apply_enemy_status(e, t["st"], float(t["d"]) * u.sd_mult, _status_power(u, t["st"]) if not t.has("p") else float(t["p"]) + _m("slow_p") * (1.0 if t["st"] == "slow" else 0.0))
			"stun_hit":
				if rng.randf() < float(t["c"]) + _m("stun_c"):
					apply_enemy_status(e, "stun", float(t["d"]) * u.sd_mult * (1.0 + _m("stun_d")))
			"fear":
				if rng.randf() < float(t["c"]) + _m("fear_c"):
					apply_enemy_status(e, "fear", float(t["d"]) * u.sd_mult)
			"mark_fast":
				if e.speed >= float(t["spd"]):
					apply_enemy_status(e, "marked", float(t["d"]) * u.sd_mult)
			"pull":
				if not flags.get("splash", false):
					push_enemy(e, float(t["d"]))
					_ev({"t": "hook", "from": u.pos, "pos": e.pos})
			"strip":
				e.shield = 0.0
				e.st.erase("haste")
	# global on-hit procs
	if _m("wet_c") > 0.0 and rng.randf() < _m("wet_c"):
		apply_enemy_status(e, "wet", 3.0 * u.sd_mult)
	if _m("oil_c") > 0.0 and rng.randf() < _m("oil_c"):
		apply_enemy_status(e, "oil", 4.0 * u.sd_mult)
	if _m("ab_c") > 0.0 and rng.randf() < _m("ab_c"):
		apply_enemy_status(e, "armor_break", 4.0 * u.sd_mult)
	if _m("stun_c") > 0.0 and not statuses.any(func(t): return t["k"] == "stun_hit") and rng.randf() < _m("stun_c") * 0.5:
		apply_enemy_status(e, "stun", 0.6 * u.sd_mult)
	if has_rule("wet_shock") and e.st.has("wet"):
		apply_enemy_status(e, "shock", 2.5 * u.sd_mult)
	if flags.get("splash", false):
		return
	# chain / pierce / bounce (primary hits only)
	for t in u.def["traits"]:
		match t["k"]:
			"chain":
				var n := int(t["n"]) + int(_m("chain_extra")) + int(syn_fx.get("chain_extra", 0))
				var pct := float(t["pct"]) * (1.0 + _m("chain_pct"))
				var from := e
				var hitset := [e.id]
				var pts: Array = [e.pos]
				for i in n:
					var best: SimEnemy = null
					var bd := float(t["r"]) * u.aoe_mult
					for o: SimEnemy in enemies:
						if o.alive and o.untargetable_t <= 0.0 and not (o.id in hitset):
							var dd := o.pos.distance_to(from.pos)
							if dd < bd:
								bd = dd; best = o
					if best == null:
						break
					hitset.append(best.id); pts.append(best.pos)
					_hit_enemy(u, best, mult * pct, {"splash": true, "show": true, "elem": "bolt"})
					if best.st.has("wet"):
						apply_enemy_status(best, "shock", 2.0 * u.sd_mult)
					from = best
				if pts.size() > 1:
					_ev({"t": "chain", "pts": pts, "unit": u.id})
			"pierce":
				var extra := int(t["n"]) + int(_m("pierce_n"))
				var done := 0
				for o: SimEnemy in enemies:
					if done >= extra:
						break
					if o.alive and o != e and o.untargetable_t <= 0.0 and absf(o.progress - e.progress) < 140.0:
						_hit_enemy(u, o, mult * 0.8, {"splash": true, "show": true})
						done += 1
	if _m("bounce") > 0.0 and rng.randf() < _m("bounce"):
		for o: SimEnemy in enemies:
			if o.alive and o != e and o.pos.distance_to(e.pos) < 160.0:
				_hit_enemy(u, o, mult * 0.7, {"splash": true, "show": true})
				break

# ================================================================= hazards / rules
func _update_hazards(dt: float) -> void:
	var i := hazards.size() - 1
	while i >= 0:
		hazards[i]["t"] = float(hazards[i]["t"]) - dt
		if hazards[i]["t"] <= 0.0:
			hazards.remove_at(i)
		i -= 1

func _update_rules(dt: float) -> void:
	if rules.is_empty() and _m("shield_every") <= 0.0:
		return
	if has_rule("green_wave"):
		green_t -= dt
		if green_t <= 0.0:
			green_t = 12.0 if not has_rule("green_wave") else 12.0 - (2.0 if "infinity_loop" in relics_owned else 0.0)
			for u: SimUnit in units:
				if u.away_t <= 0.0 and not u.st.has("stun"):
					var tl := _targets(u, _shots_for(u))
					if not tl.is_empty():
						_attack(u, tl)
			_ev({"t": "green_wave"})
	if has_rule("no_parking"):
		var t: float = float(misc_timers.get("np", 3.5)) - dt
		if t <= 0.0:
			t = 3.5
			var lead := _lead_enemy()
			if lead != null:
				for i in slots.size():
					if slots[i] == null and slot_owner(i) == 0:
						var dmg := 6.0 * hp_scale(maxi(1, wave)) * 0.7
						_damage_enemy(lead, dmg, null, {"show": true, "true": false})
						_ev({"t": "shoot", "unit": -1, "targets": [lead.pos], "kind": "bullet", "pos": slot_pos(i)})
		misc_timers["np"] = t
	if has_rule("parking_meter"):
		sp += float(empty_slots(0).size()) * 0.5 * dt
	if has_rule("interest"):
		sp += minf(3.0, sp * 0.01) * dt
	if _m("shield_every") > 0.0:
		var t2: float = float(misc_timers.get("sg", _m("shield_every"))) - dt
		if t2 <= 0.0:
			t2 = 40.0 / maxf(1.0, _m("shield_every") / 14.0 * 3.0)
			var c: Array = units.filter(func(x): return not x.st.has("shield"))
			if not c.is_empty():
				c[rng.randi() % c.size()].st["shield"] = {"t": 12.0, "p": 1.0}
		misc_timers["sg"] = t2
	if has_rule("bad_neighbours"):
		var t3: float = float(misc_timers.get("bn", 6.0)) - dt
		if t3 <= 0.0:
			t3 = 6.0
			if not units.is_empty():
				var a: SimUnit = units[rng.randi() % units.size()]
				for o: SimUnit in units:
					if _adjacent(a, o):
						o.st["jammed"] = {"t": 3.0, "p": 1.0}; break
		misc_timers["bn"] = t3

# ================================================================= offers
func _deck_tag_counts() -> Dictionary:
	var c := {}
	var ids: Array = deck.duplicate()
	for u: SimUnit in units:
		ids.append(u.uid)
	for id in ids:
		for t in Data.units[id]["tags"]:
			c[t] = int(c.get(t, 0)) + 1
	return c

func _deck_rar_counts() -> Dictionary:
	var c := {}
	for id in deck:
		var r: String = Data.units[id]["rarity"]
		c[r] = int(c.get(r, 0)) + 1
	return c

func upgrade_weight(up: Dictionary) -> float:
	if int(upgrades_taken.get(up["id"], 0)) >= int(up["max"]):
		return 0.0
	var w := 100.0
	match up["rarity"]:
		"rare": w = 55.0 + 1.2 * wave
		"epic": w = (6.0 + 1.0 * wave) if wave >= 3 else 1.0
	if chapter_idx >= 4 and up["rarity"] == "epic":
		w *= 1.3
	var tc := _deck_tag_counts()
	var denom := float(deck.size() + units.size())
	var rc := _deck_rar_counts()
	var aff := 1.0
	var any_tag := false
	for op in up["ops"]:
		var k: String = op[0]
		if k in ["tag_dmg", "tag_spd", "tag_crit", "tag_aoe", "tag_sd", "tag_proj"]:
			any_tag = true
			var cnt := float(tc.get(op[1], 0))
			aff *= 0.12 if cnt == 0.0 else 1.0 + 1.4 * cnt / maxf(1.0, denom) * 3.0
		elif k == "rar_dmg":
			any_tag = true
			var cnt2 := float(rc.get(op[1], 0))
			aff *= 0.2 if cnt2 == 0.0 else 1.0 + 0.5 * cnt2
	if up["id"] in ["extra_barrel", "burst_fire"]:
		aff *= 0.5 if not deck.any(func(i): return _unit_has_trait(i, "multi")) else 1.6
	if up["id"] in ["wide_splash", "shrapnel", "blast_zone", "cluster_cargo"]:
		aff *= 0.4 if not deck.any(func(i): return _unit_has_trait(i, "splash")) else 1.5
	if up["id"] in ["chain_reaction", "static_charge"]:
		aff *= 0.2 if not deck.any(func(i): return _unit_has_trait(i, "chain")) else 2.0
	if up["id"] in ["emergency_lane", "overtime"]:
		aff *= 0.1 if int(tc.get("emergency", 0)) < 2 else 2.0
	if up["id"] in ["carpool"]:
		aff *= 1.0 if units.size() > 4 else 0.5
	var cat: String = up["cat"]
	var hp_frac := float(city_hp) / float(city_max)
	if cat == "DEFENSE" and hp_frac < 0.5:
		aff *= 2.4
	if cat in ["ECONOMY", "DEPLOY", "SP"] and (sp < 25.0 or units.size() < 5):
		aff *= 1.6
	if cat == "MERGE" and units.size() >= slots.size() - 3:
		aff *= 1.6
	if cat == "BOSS" and (is_boss_wave(wave + 1) or is_boss_wave(wave + 2)):
		aff *= 2.2
	elif cat == "BOSS":
		aff *= 0.6
	if cat == "SYNERGY":
		aff *= 1.0 + 0.4 * synergy_active.size()
	if cfg.get("mode", "story") == "survival" and cat in ["DEFENSE", "ECONOMY"]:
		aff *= 1.3
	for k2 in upgrades_taken:
		if Data.upgrades_by_id[k2]["cat"] == cat:
			aff *= 1.12
			break
	if cat == "RULE CHANGERS" and has_any_rule_changer():
		aff *= 0.35
	return w * aff

func has_any_rule_changer() -> bool:
	for k in upgrades_taken:
		if Data.upgrades_by_id[k]["cat"] == "RULE CHANGERS":
			return true
	return false

func _unit_has_trait(id: String, k: String) -> bool:
	for t in Data.units[id]["traits"]:
		if t["k"] == k:
			return true
	return false

func roll_upgrade_offer(n: int = 3) -> Array:
	var pool: Array = []
	var weights: Array = []
	for up in Data.upgrades:
		var w := upgrade_weight(up)
		if w > 0.0:
			pool.append(up); weights.append(w)
	var out: Array = []
	var rc_taken := 0
	while out.size() < n and not pool.is_empty():
		var total := 0.0
		for w in weights:
			total += w
		var r := rng.randf() * total
		var idx := 0
		for i in weights.size():
			r -= weights[i]
			if r <= 0.0:
				idx = i; break
		var pick: Dictionary = pool[idx]
		pool.remove_at(idx); weights.remove_at(idx)
		if pick["cat"] == "RULE CHANGERS":
			if rc_taken >= 1:
				continue
			rc_taken += 1
		out.append(pick)
	return out

func roll_relic_offer(n: int = 3) -> Array:
	var pool: Array = []
	var weights: Array = []
	for r in Data.relics:
		if r["id"] in relics_owned:
			continue
		var w := 50.0
		match r["rarity"]:
			"rare": w = 36.0
			"epic": w = 14.0 + wave * 0.6
			"legendary": w = 3.0 + wave * 0.5
		for op in r["ops"]:
			if op[0] in ["tag_dmg", "tag_spd", "tag_crit"]:
				var cnt := int(_deck_tag_counts().get(op[1], 0))
				w *= 0.15 if cnt == 0 else 1.0 + cnt * 0.5
		pool.append(r); weights.append(w)
	var out: Array = []
	while out.size() < n and not pool.is_empty():
		var total := 0.0
		for w in weights:
			total += w
		var rr := rng.randf() * total
		var idx := 0
		for i in weights.size():
			rr -= weights[i]
			if rr <= 0.0:
				idx = i; break
		out.append(pool[idx]); pool.remove_at(idx); weights.remove_at(idx)
	return out

func summary() -> Dictionary:
	return {"result": result, "wave": wave, "kills": stats["kills"], "merges": stats["merges"], "deploys": stats["deploys"], "time": time,
		"max_rank": stats["max_rank"], "upgrades": stats["upgrades"], "city_hp": city_hp, "bosses": stats["bosses"], "leaks": stats["leaks"],
		"elites": stats["elites"], "sp_earned": stats["sp_earned"]}
