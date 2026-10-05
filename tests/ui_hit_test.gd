extends Node
## Every visible button on every screen must actually be reachable by pointer (nothing may sit on top of it).
## godot --headless --path . res://tests/ui_hit_test.tscn -- --save=t.json --fresh
var failures := 0
func frames(n: int) -> void:
	for i in n: await get_tree().process_frame
func idle() -> void:
	var n := 0
	while Game._transitioning and n < 600:
		await get_tree().process_frame; n += 1
func _walk(n: Node, out: Array) -> void:
	for c in n.get_children():
		if c is PaperButton and (c as PaperButton).is_visible_in_tree():
			out.append(c)
		_walk(c, out)
func _ready() -> void:
	get_window().size = Vector2i(1080, 1920)
	await frames(2)
	Game.setup(self)
	Audio.build_all()
	Save.data["flags"]["created_character"] = true
	Save.data["flags"]["tutorial_done"] = true
	Save.data["flags"]["intro_seen"] = true
	var total := 0
	for sc in ["title", "home", "modes", "units", "shop", "quests", "inventory", "settings", "profile", "customize", "codex", "leaderboard", "map"]:
		Game.go(sc, {}, false)
		await frames(40)
		for oc in Game.overlay.get_children():
			if oc is PaperPopup: oc.queue_free()
		await frames(2)
		var bs: Array = []
		_walk(Game.current, bs)
		for b: PaperButton in bs:
			if not b.enabled: continue
			var gp := b.global_position + b.size * 0.5
			var r := get_viewport().get_visible_rect()
			if not r.has_point(gp): continue
			var ev := InputEventMouseMotion.new(); ev.position = gp; ev.global_position = gp
			get_viewport().push_input(ev)
			await get_tree().process_frame
			var h := get_viewport().gui_get_hovered_control()
			var ok := h != null and (h == b or b.is_ancestor_of(h))
			total += 1
			if not ok:
				failures += 1
				print("[FAIL] %s: button '%s' at %s is covered by %s" % [sc, b.label.text if b.label else "?", gp, h])
	print("checked %d buttons" % total)
	print("HIT DONE failures=", failures)
	get_tree().quit(1 if failures > 0 else 0)
