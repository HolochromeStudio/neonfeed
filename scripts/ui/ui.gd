class_name UI
extends RefCounted
## Cut-paper UI toolkit. Everything is built in code from atlas textures (see tools/make_ui.py).

const INK := Color("2a1c1a")
const INK_SOFT := Color("5a4338")
const PAPER := Color("e2d0b0")
const CREAM := Color("eee0c2")
const RED := Color("c9524a")
const TEAL := Color("548c84")
const BLUE := Color("719cbc")
const YELLOW := Color("e9ab4b")
const ORANGE := Color("db8863")
const GREEN := Color("6ea062")
const LAVENDER := Color("8c8fb8")
const CARDBOARD := Color("56514c")
const WHITE := Color("fbf6ea")

static var font_title: Font
static var font_body: Font
static var font_hand: Font

static func init_fonts() -> void:
	if font_title != null:
		return
	font_title = load("res://assets/fonts/LilitaOne-Regular.ttf")
	font_body = load("res://assets/fonts/PatrickHand-Regular.ttf")
	font_hand = load("res://assets/fonts/Bangers-Regular.ttf")

static func label(text: String, size: int = 32, color: Color = INK, title: bool = false, align: int = HORIZONTAL_ALIGNMENT_CENTER, outline: int = 0, outline_color: Color = INK) -> Label:
	init_fonts()
	var l := Label.new()
	l.text = text
	l.horizontal_alignment = align
	l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	l.add_theme_font_override("font", font_title if title else font_body)
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	if outline > 0:
		l.add_theme_constant_override("outline_size", outline)
		l.add_theme_color_override("font_outline_color", outline_color)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return l

static func rich(bbcode: String, size: int = 30, color: Color = INK) -> RichTextLabel:
	init_fonts()
	var r := RichTextLabel.new()
	r.bbcode_enabled = true
	r.fit_content = true
	r.scroll_active = false
	r.add_theme_font_override("normal_font", font_body)
	r.add_theme_font_override("bold_font", font_title)
	r.add_theme_font_size_override("normal_font_size", size)
	r.add_theme_font_size_override("bold_font_size", size)
	r.add_theme_color_override("default_color", color)
	r.text = bbcode
	r.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return r

static func icon(key: String, w: float = 64.0, h: float = -1.0) -> TextureRect:
	return Atlas.rect(key, w, w if h < 0.0 else h)

static func panel(kind: String = "paper", size: Vector2 = Vector2(400, 300), margin: int = 44) -> NinePatchRect:
	var n := Atlas.nine("ui_panel_" + kind, margin)
	n.custom_minimum_size = size
	n.size = size
	return n

static func spacer(w: float, h: float) -> Control:
	var c := Control.new()
	c.custom_minimum_size = Vector2(w, h)
	c.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return c

static func btn(text: String, color: String = "teal", size: Vector2 = Vector2(360, 110), cb: Callable = Callable(), font_size: int = 44, icon_key: String = "") -> PaperButton:
	var b := PaperButton.new()
	b.setup(text, color, size, font_size, icon_key)
	if cb.is_valid():
		b.pressed.connect(cb)
	return b

## Make a control tappable inside ScrollContainers: PASS lets drags scroll the list; a release within ~18px of the press is a tap.
static func tappable(c: Control, cb: Callable) -> void:
	c.mouse_filter = Control.MOUSE_FILTER_PASS
	var st := {"p": Vector2.ZERO, "down": false}
	c.gui_input.connect(func(ev: InputEvent):
		if ev is InputEventMouseButton and ev.button_index == MOUSE_BUTTON_LEFT:
			if ev.pressed:
				st["p"] = ev.global_position; st["down"] = true
			elif st["down"]:
				st["down"] = false
				if ev.global_position.distance_to(st["p"]) < 18.0:
					cb.call()
		elif ev is InputEventMouseMotion and st["down"] and ev.global_position.distance_to(st["p"]) >= 18.0:
			st["down"] = false)

static func set_full_rect(c: Control) -> void:
	c.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)

static func center_pivot(c: Control) -> void:
	c.pivot_offset = c.size * 0.5

# ------------------------------------------------------------------ rarity chip / stars
static func rarity_chip(r: String, w: float = 150.0) -> Control:
	var root := Control.new()
	root.custom_minimum_size = Vector2(w, 40)
	root.size = Vector2(w, 40)
	var bg := Atlas.nine("ui_chip_" + r, 12)
	bg.size = Vector2(w, 40)
	root.add_child(bg)
	var l := label(Data.RARITY_NAMES[r], 22, INK, true)
	l.size = Vector2(w, 38)
	root.add_child(l)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return root

static func stars(n: int, size: float = 28.0, max_n: int = 7) -> HBoxContainer:
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", -4)
	h.mouse_filter = Control.MOUSE_FILTER_IGNORE
	for i in max_n:
		if i >= n:
			break
		h.add_child(icon("ui_star_gold", size))
	return h

# ------------------------------------------------------------------ tween helpers
static func pop_in(node: CanvasItem, delay: float = 0.0, from_scale: float = 0.6) -> void:
	if node is Control:
		(node as Control).pivot_offset = (node as Control).size * 0.5
	node.scale = Vector2.ONE * from_scale
	node.modulate.a = 0.0
	var tw := node.create_tween()
	tw.set_parallel(true)
	tw.tween_property(node, "modulate:a", 1.0, 0.15).set_delay(delay)
	tw.tween_property(node, "scale", Vector2.ONE, 0.42).set_delay(delay).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)

## Paper "unfold": scale Y from 0 + slight rotation settle.
static func unfold(node: Control, delay: float = 0.0) -> void:
	node.pivot_offset = Vector2(node.size.x * 0.5, 0)
	node.scale = Vector2(1, 0.05)
	node.rotation = deg_to_rad(-1.5)
	node.modulate.a = 0.0
	var tw := node.create_tween()
	tw.set_parallel(true)
	tw.tween_property(node, "modulate:a", 1.0, 0.12).set_delay(delay)
	tw.tween_property(node, "scale", Vector2.ONE, 0.45).set_delay(delay).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tw.tween_property(node, "rotation", 0.0, 0.5).set_delay(delay).set_trans(Tween.TRANS_ELASTIC).set_ease(Tween.EASE_OUT)

static func slide_in(node: Control, from: Vector2, delay: float = 0.0, dur: float = 0.45) -> void:
	var target := node.position
	node.position = target + from
	node.modulate.a = 0.0
	var tw := node.create_tween()
	tw.set_parallel(true)
	tw.tween_property(node, "position", target, dur).set_delay(delay).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	tw.tween_property(node, "modulate:a", 1.0, 0.2).set_delay(delay)

static func wobble(node: Node2D, amt: float = 0.05, dur: float = 0.35) -> void:
	var tw := node.create_tween()
	tw.tween_property(node, "rotation", amt, dur * 0.25)
	tw.tween_property(node, "rotation", -amt * 0.7, dur * 0.25)
	tw.tween_property(node, "rotation", 0.0, dur * 0.5).set_trans(Tween.TRANS_ELASTIC).set_ease(Tween.EASE_OUT)

static func stamp(node: Control, delay: float = 0.0) -> void:
	node.pivot_offset = node.size * 0.5
	node.scale = Vector2(2.4, 2.4)
	node.modulate.a = 0.0
	node.rotation = deg_to_rad(-14)
	var tw := node.create_tween()
	tw.set_parallel(true)
	tw.tween_property(node, "modulate:a", 1.0, 0.08).set_delay(delay)
	tw.tween_property(node, "scale", Vector2.ONE, 0.2).set_delay(delay).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
	tw.tween_property(node, "rotation", deg_to_rad(-6), 0.2).set_delay(delay)
	tw.chain().tween_callback(func(): Audio.sfx("stamp"))

# ------------------------------------------------------------------ background
static func paper_bg(parent: Control, base: Color = Color("57524d"), halftone: bool = true) -> ColorRect:
	var bg := ColorRect.new()
	bg.color = base
	set_full_rect(bg)
	bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	parent.add_child(bg)
	var g := TextureRect.new()
	g.texture = Atlas.tile("ui_grain_tile")
	g.stretch_mode = TextureRect.STRETCH_TILE
	g.modulate = Color(1, 1, 1, 0.16)
	set_full_rect(g)
	g.mouse_filter = Control.MOUSE_FILTER_IGNORE
	bg.add_child(g)
	if halftone:
		var h := TextureRect.new()
		h.texture = Atlas.tile("ui_halftone_tile")
		h.stretch_mode = TextureRect.STRETCH_TILE
		h.modulate = Color(1, 1, 1, 0.2)
		set_full_rect(h)
		h.mouse_filter = Control.MOUSE_FILTER_IGNORE
		bg.add_child(h)
	var v := TextureRect.new()
	v.texture = Atlas.tex("ui_vignette")
	v.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	v.stretch_mode = TextureRect.STRETCH_SCALE
	set_full_rect(v)
	v.mouse_filter = Control.MOUSE_FILTER_IGNORE
	bg.add_child(v)
	return bg

# ------------------------------------------------------------------ unit card
static func unit_card(id: String, size: Vector2 = Vector2(200, 270), show_level: bool = true, dim: bool = false) -> Control:
	var d: Dictionary = Data.units[id]
	var root := Control.new()
	root.custom_minimum_size = size
	root.size = size
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var bg := Atlas.nine("ui_card_" + d["rarity"], 28)
	bg.size = size
	root.add_child(bg)
	var rc: Color = Data.rarity_color(d["rarity"])
	var band := ColorRect.new()
	band.color = Color(rc.r, rc.g, rc.b, 0.35)
	band.position = Vector2(size.x * 0.1, size.y * 0.08)
	band.size = Vector2(size.x * 0.8, size.y * 0.5)
	band.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(band)
	var sprite := Atlas.rect(Data.unit_art(id), size.x * 0.9, size.y * 0.46)
	sprite.position = Vector2(size.x * 0.05, size.y * 0.1)
	root.add_child(sprite)
	var nm := label(d["name"], int(size.x * (0.17 if String(d["name"]).length() <= 9 else 0.125)), INK, true)
	nm.position = Vector2(4, size.y * 0.6)
	nm.size = Vector2(size.x - 8, size.y * 0.16)
	nm.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	nm.clip_text = true
	root.add_child(nm)
	var chip := rarity_chip(d["rarity"], size.x * 0.7)
	chip.scale = Vector2.ONE * (size.x * 0.0036)
	chip.position = Vector2(size.x * 0.15, size.y * 0.81)
	root.add_child(chip)
	if show_level and Save.owns(id):
		var lv := label("Lv %d" % Save.unit_level(id), int(size.x * 0.12), WHITE, true, HORIZONTAL_ALIGNMENT_CENTER, 4)
		lv.position = Vector2(size.x * 0.04, size.y * 0.03)
		lv.size = Vector2(size.x * 0.4, size.y * 0.1)
		root.add_child(lv)
	if dim:
		root.modulate = Color(0.45, 0.45, 0.45, 0.9)
	return root

static func resource_pill(kind: String, width: float = 220.0) -> Control:
	var root := Control.new()
	root.custom_minimum_size = Vector2(width, 70)
	root.size = Vector2(width, 70)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var bg := Atlas.nine("ui_pill", 28)
	bg.size = Vector2(width, 70)
	root.add_child(bg)
	var ic := icon("icon_" + {"coins": "coin", "gems": "gem", "tickets": "ticket"}.get(kind, "coin"), 54)
	ic.position = Vector2(8, 8)
	root.add_child(ic)
	var l := label("0", 34, WHITE, true, HORIZONTAL_ALIGNMENT_RIGHT)
	l.position = Vector2(62, 0)
	l.size = Vector2(width - 80, 70)
	root.add_child(l)
	var upd := func():
		l.text = _fmt(int(Save.data["wallet"][kind]))
	upd.call()
	Save.changed.connect(upd)
	root.tree_exiting.connect(func(): if Save.changed.is_connected(upd): Save.changed.disconnect(upd))
	return root

static func _fmt(n: int) -> String:
	if n >= 1000000:
		return "%.1fM" % (n / 1000000.0)
	if n >= 10000:
		return "%.1fK" % (n / 1000.0)
	return str(n)

static func fmt_num(n: float) -> String:
	if n == floorf(n) and n < 10000.0:
		return str(int(n))
	if n >= 1000000.0:
		return "%.1fM" % (n / 1000000.0)
	if n >= 10000.0:
		return "%.1fK" % (n / 1000.0)
	if n >= 100.0:
		return str(int(n))
	if n >= 10.0:
		return "%.0f" % n
	return "%.1f" % n

static func fmt_time(s: float) -> String:
	return "%d:%02d" % [int(s) / 60, int(s) % 60]
