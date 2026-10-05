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
