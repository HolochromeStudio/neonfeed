extends Screen
## Offline shop: vehicle packs, boosters and currency exchange (all paid with in-game currencies).

const PACKS := [
	{"id": "common_pack", "name": "STREET PACK", "desc": "3 vehicle cards - mostly Common/Uncommon.", "cost": 150, "cur": "coins", "n": 3, "w": {"common": 60, "uncommon": 30, "rare": 9, "epic": 1}, "color": "gray"},
	{"id": "service_pack", "name": "SERVICE PACK", "desc": "3 cards - Uncommon to Epic.", "cost": 15, "cur": "gems", "n": 3, "w": {"uncommon": 45, "rare": 40, "epic": 14, "legendary": 1}, "color": "blue"},
	{"id": "elite_pack", "name": "ELITE CRATE", "desc": "3 cards - Rare and better!", "cost": 40, "cur": "gems", "n": 3, "w": {"rare": 50, "epic": 35, "legendary": 13, "mythic": 2}, "color": "orange"},
	{"id": "mythic_pack", "name": "MYTHIC CRATE", "desc": "1 guaranteed Legendary or Mythic.", "cost": 90, "cur": "gems", "n": 1, "w": {"legendary": 80, "mythic": 20}, "color": "red"},
]
const GOODS := [
	{"id": "rush_ticket", "name": "RUSH TICKET", "desc": "Start a run with +30 SP.", "cost": 120, "cur": "coins", "icon": "icon_bolt"},
	{"id": "spare_tire", "name": "SPARE TIRE", "desc": "+6 city HP for one run.", "cost": 150, "cur": "coins", "icon": "icon_tire"},
	{"id": "lucky_dice", "name": "LUCKY DICE", "desc": "x1.5 coin rewards for one run.", "cost": 5, "cur": "tickets", "icon": "icon_star"},
]

func _ready() -> void:
	music = "menu"
	super._ready()
	UI.paper_bg(self)
	add_topbar(true, "SHOP")
	var vp := vsize()
	var sc := ScrollContainer.new()
	sc.position = Vector2(20, Game.safe_top + 120)
	sc.size = Vector2(vp.x - 40, vp.y - Game.safe_top - 130 - Game.safe_bottom)
	sc.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	add_child(sc)
	var vb := VBoxContainer.new()
	vb.add_theme_constant_override("separation", 14)
	vb.custom_minimum_size = Vector2(vp.x - 60, 0)
	sc.add_child(vb)
	vb.add_child(UI.label("DAILY DEAL", 44, UI.WHITE, true, HORIZONTAL_ALIGNMENT_LEFT, 8))
	vb.add_child(_daily_deal())
	vb.add_child(UI.label("VEHICLE PACKS", 44, UI.WHITE, true, HORIZONTAL_ALIGNMENT_LEFT, 8))
	for p in PACKS:
		vb.add_child(_offer_row(p["name"], p["desc"], int(p["cost"]), p["cur"], "icon_crown", func(): _buy_pack(p), p["color"]))
	vb.add_child(UI.label("BOOSTERS", 44, UI.WHITE, true, HORIZONTAL_ALIGNMENT_LEFT, 8))
	for g in GOODS:
		var have: int = int(Save.data["inventory"].get(g["id"], 0))
		vb.add_child(_offer_row("%s  (owned %d)" % [g["name"], have], g["desc"], int(g["cost"]), g["cur"], g["icon"], func(): _buy_good(g), "yellow"))
	vb.add_child(UI.label("EXCHANGE", 44, UI.WHITE, true, HORIZONTAL_ALIGNMENT_LEFT, 8))
	vb.add_child(_offer_row("500 COINS", "Convert gems to coins.", 5, "gems", "icon_coin", func(): _exchange(5, 500, "coins"), "teal"))
	vb.add_child(_offer_row("3 TICKETS", "Convert gems to tickets.", 6, "gems", "icon_ticket", func(): _exchange(6, 3, "tickets"), "teal"))
	vb.add_child(UI.label("Everything here uses in-game currency only. Earn more by playing!", 28, Color(1, 1, 1, 0.7)))

func _daily_deal() -> Control:
	var rng := RandomNumberGenerator.new()
	rng.seed = hash(Save.today())
	var pool := Data.unit_list.filter(func(u): return u["rarity"] in ["uncommon", "rare", "epic"])
	var u: Dictionary = pool[rng.randi() % pool.size()]
	var cost := 60 + 40 * Data.RARITIES.find(u["rarity"])
	var bought: bool = Save.data["flags"]["tips"].get("deal_" + Save.today(), false)
	var row := _offer_row("%s x5 CARDS" % String(u["name"]).to_upper(), "Today only: 5 cards of %s!" % u["name"], cost, "coins", "icon_star", func():
		if Save.data["flags"]["tips"].get("deal_" + Save.today(), false):
			Game.toast("Already bought today", "icon_alert"); return
		if Save.spend("coins", cost):
			Save.add_cards(u["id"], 5)
			Save.data["flags"]["tips"]["deal_" + Save.today()] = true
			Audio.sfx("coin"); Game.toast("5 %s cards!" % u["name"], "icon_coin")
			Game.go("shop", {}, false, false)
		else:
			Audio.sfx("error"); Game.toast("Not enough coins", "icon_coin"), "red")
	if bought:
		row.modulate = Color(0.7, 0.7, 0.7)
	return row

func _offer_row(title: String, desc: String, cost: int, cur: String, icon_key: String, cb: Callable, color: String) -> Control:
	var vp := vsize()
	var r := Control.new()
	r.custom_minimum_size = Vector2(vp.x - 60, 140)
	var bg := Atlas.nine("ui_panel_paper", 36)
	bg.size = r.custom_minimum_size
	r.add_child(bg)
	var ic := UI.icon(icon_key, 90)
	ic.position = Vector2(26, 25)
	r.add_child(ic)
	var t := UI.label(title, 34, UI.INK, true, HORIZONTAL_ALIGNMENT_LEFT)
	t.position = Vector2(140, 14); t.size = Vector2(520, 46)
	r.add_child(t)
	var d := UI.label(desc, 26, UI.INK_SOFT, false, HORIZONTAL_ALIGNMENT_LEFT)
	d.position = Vector2(140, 66); d.size = Vector2(520, 60)
	d.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	r.add_child(d)
	var b := UI.btn("%d" % cost, color if color != "gray" else "blue", Vector2(220, 84), cb, 40, "icon_" + {"coins": "coin", "gems": "gem", "tickets": "ticket"}[cur])
	b.position = Vector2(r.custom_minimum_size.x - 250, 28)
	r.add_child(b)
	return r

func _buy_pack(p: Dictionary) -> void:
	if not Save.spend(p["cur"], int(p["cost"])):
		Audio.sfx("error"); Game.toast("Not enough %s" % p["cur"], "icon_alert"); return
	var rng := RandomNumberGenerator.new()
	rng.randomize()
	var results: Array = []
	for i in int(p["n"]):
		var total := 0
		for r in p["w"]:
			total += int(p["w"][r])
		var roll := rng.randi() % total
		var rar := "common"
		for r in p["w"]:
			roll -= int(p["w"][r])
			if roll < 0:
				rar = r; break
		var pool := Data.units_of_rarity(rar)
		var u: Dictionary = pool[rng.randi() % pool.size()]
		results.append(u["id"])
	var body := VBoxContainer.new()
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 14)
	var k := 0
	for id in results:
		var was_new := not Save.owns(id)
		if was_new:
			Save.unlock_unit(id)
		else:
			Save.add_cards(id, 3 + Data.RARITIES.find(Data.units[id]["rarity"]))
		var h := Control.new()
		h.custom_minimum_size = Vector2(230, 320)
		var c := UI.unit_card(id, Vector2(230, 300), false)
		h.add_child(c)
		var tag := UI.label("NEW!" if was_new else "+%d cards" % (3 + Data.RARITIES.find(Data.units[id]["rarity"])), 30, UI.WHITE, true, HORIZONTAL_ALIGNMENT_CENTER, 7)
		tag.position = Vector2(0, 296); tag.size = Vector2(230, 40)
		h.add_child(tag)
		row.add_child(h)
		c.pivot_offset = Vector2(115, 150)
		c.scale = Vector2(0.01, 1.0)
		var tw := create_tween()
		tw.tween_interval(0.5 * k + 0.2)
		tw.tween_property(c, "scale", Vector2(1.1, 1.1), 0.25).set_trans(Tween.TRANS_BACK)
		tw.tween_property(c, "scale", Vector2.ONE, 0.1)
		tw.tween_callback(func(): Audio.sfx("stamp", 1.0 + 0.1 * Data.RARITIES.find(Data.units[id]["rarity"])))
		k += 1
	body.add_child(row)
	Audio.sfx("unlock")
	Game.popup(p["name"], body, [{"text": "NICE!", "color": "green"}], Vector2(960 if results.size() > 1 else 520, 620))

func _buy_good(g: Dictionary) -> void:
	if Save.spend(g["cur"], int(g["cost"])):
		Save.data["inventory"][g["id"]] = int(Save.data["inventory"].get(g["id"], 0)) + 1
		Save.mark_dirty()
		Audio.sfx("coin"); Game.toast("%s added!" % g["name"], g["icon"])
		Game.go("shop", {}, false, false)
	else:
		Audio.sfx("error"); Game.toast("Not enough %s" % g["cur"], "icon_alert")

func _exchange(gems: int, amount: int, to: String) -> void:
	if Save.spend("gems", gems):
		Save.add_wallet(to, amount)
		Audio.sfx("coin"); Game.toast("+%d %s" % [amount, to], "icon_coin")
	else:
		Audio.sfx("error"); Game.toast("Not enough gems", "icon_gem")
