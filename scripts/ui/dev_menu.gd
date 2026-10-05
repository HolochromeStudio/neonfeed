class_name DevMenu
extends Control
## Developer cheats / inspection (debug builds, --dev flag).

func _ready() -> void:
	UI.set_full_rect(self)
	var dim := ColorRect.new(); dim.color = Color(0, 0, 0, 0.6); UI.set_full_rect(dim); add_child(dim)
	var p := UI.panel("dark", Vector2(900, 1300), 40)
	p.position = Vector2(90, 200)
	add_child(p)
	var v := VBoxContainer.new()
	v.position = Vector2(50, 50); v.size = Vector2(800, 1200)
	v.add_theme_constant_override("separation", 10)
	p.add_child(v)
	v.add_child(UI.label("DEV MENU", 50, UI.WHITE, true))
	var items := [
		["+1000 coins / +100 gems", func(): Save.add_wallet("coins", 1000); Save.add_wallet("gems", 100)],
		["Unlock ALL vehicles", func(): for id in Data.units: Save.unlock_unit(id)],
		["Unlock ALL cosmetics", func(): for c in Data.cosmetics: Save.unlock_cosmetic(c["id"])],
		["Clear ALL campaign levels", func(): for ch in Data.chapters: for l in ch["levels"]: Save.data["campaign"]["cleared"][l["id"]] = {"stars": 3, "best_wave": l["waves"]}],
		["Max account level 30", func(): Save.add_xp(30000)],
		["Toggle god mode (city invulnerable)", func(): Dev.god_mode = not Dev.god_mode],
		["Toggle FPS counter", func(): Dev.set_show_fps(not Dev.show_fps)],
		["Reset daily reward / quests", func(): Save.data["daily_reward"]["last"] = ""; Save.data["quests"]["daily_date"] = ""; Save.refresh_quests()],
		["Replay intro", func(): Save.data["flags"]["intro_seen"] = false; Game.go("intro")],
		["Run content validator (see log)", func(): ContentValidator.run()],
		["RESET SAVE", func(): Save.reset_all(); Game.go("boot", {}, false, false)],
	]
	for it in items:
		var b := UI.btn(it[0], "gray", Vector2(780, 76), func():
			it[1].call()
			Game.toast("done: " + it[0].substr(0, 28)), 30)
		v.add_child(b)
	v.add_child(UI.btn("CLOSE", "red", Vector2(780, 80), func(): Dev.toggle_menu(), 36))
