extends Node
## Aggregates all static content. Access: Data.units["taxi"], Data.upgrades_by_id[...], etc.

const RARITIES := ["common", "uncommon", "rare", "epic", "legendary", "mythic"]
const RARITY_COLORS := {
	"common": Color("969692"), "uncommon": Color("78a878"), "rare": Color("7496cd"),
	"epic": Color("aa78be"), "legendary": Color("e8965c"), "mythic": Color("dc6c82"),
}
const RARITY_NAMES := {"common": "COMMON", "uncommon": "UNCOMMON", "rare": "RARE", "epic": "EPIC", "legendary": "LEGENDARY", "mythic": "MYTHIC"}

var units: Dictionary = {}
var unit_list: Array = []
var enemies: Dictionary = {}
var bosses: Dictionary = {}
var statuses: Dictionary = {}
var upgrades: Array = []
var upgrades_by_id: Dictionary = {}
var relics: Array = []
var relics_by_id: Dictionary = {}
var synergies: Array = []
var chapters: Array = []
var quests_daily: Array = []
var quests_weekly: Array = []
var achievements: Array = []
var cosmetics: Array = []
var cosmetics_by_id: Dictionary = {}
var story: Dictionary = {}

func _ready() -> void:
	unit_list = UnitsData.build()
	for u in unit_list:
		units[u["id"]] = u
	for e in EnemiesData.enemies():
		enemies[e["id"]] = e
	for b in EnemiesData.bosses():
		bosses[b["id"]] = b
	statuses = EnemiesData.statuses()
	upgrades = UpgradesData.build()
	for u in upgrades:
		upgrades_by_id[u["id"]] = u
	relics = RelicsData.build()
	for r in relics:
		relics_by_id[r["id"]] = r
	synergies = SynergyData.build()
	chapters = MetaData.chapters()
	quests_daily = MetaData.quests_daily()
	quests_weekly = MetaData.quests_weekly()
	achievements = MetaData.achievements()
	cosmetics = MetaData.cosmetics()
	for c in cosmetics:
		cosmetics_by_id[c["id"]] = c
	story = StoryData.build()

func unit_art(id: String) -> String:
	return "veh_" + id

func rarity_color(r: String) -> Color:
	return RARITY_COLORS.get(r, Color.WHITE)

func units_of_rarity(r: String) -> Array:
	return unit_list.filter(func(u): return u["rarity"] == r)

## Visual definition (art key, wheel layout, display scale) - everything the renderer needs for a vehicle.
func unit_visual(id: String) -> Dictionary:
	var u: Dictionary = units[id]
	var big: bool = "heavy" in u["tags"] or "bus" in u["tags"]
	return {"art": "veh_" + id, "wheels": Atlas.wheels("veh_" + id).size(), "scale_bias": 1.08 if big else 1.0, "glow_rank": 4,
		"rarity_color": rarity_color(u["rarity"])}

const ANIM_BY_PROJ := {
	"bullet": {"recoil": 70.0, "squash": 0.93, "tilt": 0.08, "rumble": 8.0},
	"lob": {"recoil": 110.0, "squash": 0.88, "tilt": 0.12, "rumble": 6.0},
	"bolt": {"recoil": 40.0, "squash": 0.96, "tilt": 0.05, "rumble": 14.0},
	"beam": {"recoil": 20.0, "squash": 0.98, "tilt": 0.03, "rumble": 18.0},
	"wave": {"recoil": 60.0, "squash": 0.9, "tilt": 0.1, "rumble": 7.0},
}
## Animation definition: which clips a vehicle has and how strongly they play (SPAWN, IDLE, TARGET, ATTACK, ABILITY, HIT,
## BUFF, DEBUFF, STUN, MERGE_START/END, MOVE, TURN, BRAKE, DESTROY, VICTORY are all driven from this by UnitNode).
func unit_anim(id: String) -> Dictionary:
	var u: Dictionary = units[id]
	var a: Dictionary = ANIM_BY_PROJ.get(u["proj"], ANIM_BY_PROJ["bullet"]).duplicate()
	a["heavy"] = "heavy" in u["tags"]
	a["clips"] = ["spawn", "idle", "target", "attack", "ability", "hit", "buff", "debuff", "stun", "merge_start", "merge_end", "move", "turn", "brake", "destroy", "victory"]
	a["spawn_time"] = 0.6 if not a["heavy"] else 0.75
	return a
