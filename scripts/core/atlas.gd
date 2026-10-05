extends Node
## Runtime sprite atlas. Pages + rects are produced by tools/build_atlas.py (assets/runtime/atlas.json).

var _pages: Array[Texture2D] = []
var _entries: Dictionary = {}
var _cache: Dictionary = {}

func _ready() -> void:
	var f := FileAccess.open("res://assets/runtime/atlas.json", FileAccess.READ)
	var j: Dictionary = JSON.parse_string(f.get_as_text())
	for p in j["pages"]:
		_pages.append(load("res://assets/runtime/" + p))
	_entries = j["entries"]

func has(key: String) -> bool:
	return _entries.has(key)

func keys() -> Array:
	return _entries.keys()

func tex(key: String) -> AtlasTexture:
	if _cache.has(key):
		return _cache[key]
	if not _entries.has(key):
		push_warning("Atlas: missing '%s'" % key)
		key = "ui_star_gray"
	var e: Dictionary = _entries[key]
	var t := AtlasTexture.new()
	t.atlas = _pages[int(e["page"])]
	var r: Array = e["rect"]
	t.region = Rect2(r[0], r[1], r[2], r[3])
	_cache[key] = t
	return t

func size(key: String) -> Vector2:
	return tex(key).region.size

## Centered sprite whose pivot is the bottom-middle ("feet") when feet=true.
func sprite(key: String, feet: bool = false) -> Sprite2D:
	var s := Sprite2D.new()
	s.texture = tex(key)
	if feet:
		s.offset = Vector2(0, -s.texture.region.size.y * 0.5)
	return s

func rect(key: String, w: float, h: float) -> TextureRect:
	var r := TextureRect.new()
	r.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	r.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	r.texture = tex(key)
	r.custom_minimum_size = Vector2(w, h)
	r.size = Vector2(w, h)
	r.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return r

func nine(key: String, margin: int) -> NinePatchRect:
	var n := NinePatchRect.new()
	var t := tex(key)
	n.texture = t.atlas
	n.region_rect = t.region
	n.patch_margin_left = margin
	n.patch_margin_right = margin
	n.patch_margin_top = margin
	n.patch_margin_bottom = margin
	n.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return n

var _tiles: Dictionary = {}
## Standalone repeating texture (tile_*, ui_grain_tile, ui_halftone_tile). Use for TextureRect STRETCH_TILE / Line2D tiling.
func tile(name: String) -> Texture2D:
	if not _tiles.has(name):
		_tiles[name] = load("res://assets/runtime/tex/%s.png" % name)
	return _tiles[name]

var _wheels: Dictionary = {}
var _wheels_loaded: bool = false
## Wheel layout for a vehicle sprite key (veh_x / en_x): [[x, y, r], ...] in runtime px relative to the sprite's bottom-centre.
func wheels(key: String) -> Array:
	if not _wheels_loaded:
		_wheels_loaded = true
		var f := FileAccess.open("res://assets/runtime/wheels.json", FileAccess.READ)
		if f:
			_wheels = JSON.parse_string(f.get_as_text())
	return _wheels.get(key, [])
