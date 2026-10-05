extends Screen
## Daily / weekly quests and achievements.

var tab: String = "daily"
var list: VBoxContainer
var tabs: Dictionary = {}

func _ready() -> void:
	music = "menu"
	super._ready()
	UI.paper_bg(self, "green")
	add_topbar(true, "QUESTS")
	Save.refresh_quests()
	var vp := vsize()
	var y := Game.safe_top + 120.0
	var tr := HBoxContainer.new()
	tr.position = Vector2(20, y)
	tr.add_theme_constant_override("separation", 10)
	add_child(tr)
	for t in [["daily", "DAILY"], ["weekly", "WEEKLY"], ["ach", "ACHIEVEMENTS"]]:
		var b := UI.btn(t[1], "red" if t[0] == tab else "gray", Vector2(330 if t[0] == "ach" else 300, 84), func(): tab = t[0]; _rebuild(); _recolor(), 34)
		tr.add_child(b)
		tabs[t[0]] = b
	var sc := ScrollContainer.new()
	sc.position = Vector2(20, y + 100)
	sc.size = Vector2(vp.x - 40, vp.y - y - 110 - Game.safe_bottom)
	sc.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	add_child(sc)
	list = VBoxContainer.new()
	list.add_theme_constant_override("separation", 12)
	list.custom_minimum_size = Vector2(vp.x - 60, 0)
	sc.add_child(list)
	_rebuild()

func _recolor() -> void:
	for k in tabs:
		var b: PaperButton = tabs[k]
		b._color = "red" if k == tab else "gray"
		b._set_tex("ui_btn_%s_up" % b._color)

func _row(title: String, desc: String, progress: int, goal: int, coins: int, gems: int, state: String, on_claim: Callable, extra: String = "") -> Control:
	var vp := vsize()
	var r := Control.new()
	r.custom_minimum_size = Vector2(vp.x - 60, 150)
	var bg := Atlas.nine("ui_panel_paper" if state != "claimed" else "ui_panel_gray", 36)
	bg.size = r.custom_minimum_size
	r.add_child(bg)
	var t := UI.label(title, 38, UI.INK, true, HORIZONTAL_ALIGNMENT_LEFT)
	t.position = Vector2(30, 10); t.size = Vector2(560, 46)
	r.add_child(t)
	var d := UI.label(desc, 28, UI.INK_SOFT, false, HORIZONTAL_ALIGNMENT_LEFT)
	d.position = Vector2(30, 54); d.size = Vector2(560, 36)
	r.add_child(d)
	var pb := Atlas.nine("ui_bar_bg", 18)
	pb.size = Vector2(500, 26); pb.position = Vector2(30, 104)
	r.add_child(pb)
	var pf := Atlas.nine("ui_bar_fill_green" if progress >= goal else "ui_bar_fill_blue", 18)
	pf.size = Vector2(maxf(18.0, 500.0 * clampf(float(progress) / float(maxi(1, goal)), 0, 1)), 26); pf.position = pb.position
	r.add_child(pf)
	var pl := UI.label("%s / %s" % [UI.fmt_num(progress), UI.fmt_num(goal)], 22, UI.WHITE, true, HORIZONTAL_ALIGNMENT_CENTER, 4)
	pl.size = pb.size; pl.position = pb.position
	r.add_child(pl)
	var rw := UI.label("%d" % coins + ("   %d" % gems if gems > 0 else ""), 30, UI.INK, true, HORIZONTAL_ALIGNMENT_LEFT)
	rw.position = Vector2(660, 18); rw.size = Vector2(200, 40)
	r.add_child(rw)
	var ci := UI.icon("icon_coin", 34); ci.position = Vector2(620, 20)
	r.add_child(ci)
	if gems > 0:
		var gi := UI.icon("icon_gem", 34); gi.position = Vector2(760, 20)
		r.add_child(gi)
		rw.text = "%d      %d" % [coins, gems]
	if extra != "":
		var ex := UI.label(extra, 24, UI.RED, true, HORIZONTAL_ALIGNMENT_LEFT)
		ex.position = Vector2(620, 56); ex.size = Vector2(300, 32)
		r.add_child(ex)
	var btn: PaperButton
	if state == "ready":
		btn = UI.btn("CLAIM", "green", Vector2(200, 76), on_claim, 34)
	elif state == "claimed":
		btn = UI.btn("DONE", "gray", Vector2(200, 76), Callable(), 34)
		btn.set_enabled(false)
	else:
		btn = UI.btn("...", "gray", Vector2(200, 76), Callable(), 34)
		btn.set_enabled(false)
	btn.position = Vector2(r.custom_minimum_size.x - 230, 62)
	r.add_child(btn)
	return r

func _rebuild() -> void:
	for c in list.get_children():
		c.queue_free()
	if tab in ["daily", "weekly"]:
		var lst: Array = Save.data["quests"][tab]
		for i in lst.size():
			var it: Dictionary = lst[i]
			var d := Save.quest_def(it["id"])
			var state := "claimed" if it["claimed"] else ("ready" if int(it["progress"]) >= int(it["n"]) else "locked")
			var idx := i
			var row := _row(d["name"], String(d["desc"]).replace("{n}", str(it["n"])), mini(int(it["progress"]), int(it["n"])), int(it["n"]), int(d["coins"]), int(d["gems"]), state,
				func():
					if Save.claim_quest(tab, idx):
						Audio.sfx("coin"); Game.toast("Quest reward claimed!", "icon_coin"); _rebuild())
			list.add_child(row)
		if lst.is_empty():
			list.add_child(UI.label("No quests yet", 40, UI.WHITE))
		var note := UI.label("Resets %s" % ("every day" if tab == "daily" else "every week"), 28, Color(1, 1, 1, 0.7))
		list.add_child(note)
	else:
		for a in Data.achievements:
			var st := Save.ach_state(a["id"])
			var cur := mini(Save.stat(a["stat"]), int(a["n"]))
			var state := "claimed" if st.get("claimed", false) else ("ready" if st.get("done", false) else "locked")
			var extra := ""
			if a["unit"] != "": extra = "+ " + Data.units[a["unit"]]["name"]
			elif a["cos"] != "": extra = "+ " + Data.cosmetics_by_id[a["cos"]]["name"]
			var aid: String = a["id"]
			list.add_child(_row(a["name"], a["desc"], cur, int(a["n"]), int(a["coins"]), int(a["gems"]), state,
				func():
					if Save.claim_achievement(aid):
						Audio.sfx("levelup"); Game.toast("Achievement claimed!", "icon_trophy"); _rebuild(), extra))
