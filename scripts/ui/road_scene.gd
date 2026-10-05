class_name RoadScene
extends Control
## Animated paper-collage street used on title / home / menus: scrolling asphalt, props, and traffic with wheel bob.

const BIOME_LOOK := {
	"city_center": {"ground": "ground_concrete", "tint": Color(0.82, 0.82, 0.86), "sky": Color("7fa6c8")},
	"suburbs": {"ground": "ground_grass_flowers", "tint": Color(1, 1, 1), "sky": Color("93bcd8")},
	"highway": {"ground": "ground_dry", "tint": Color(1, 0.95, 0.85), "sky": Color("9bb5c6")},
	"industrial": {"ground": "ground_concrete", "tint": Color(0.75, 0.72, 0.68), "sky": Color("a8a39a")},
	"desert": {"ground": "ground_sand", "tint": Color(1.1, 0.95, 0.8), "sky": Color("e9a96a")},
	"snow_town": {"ground": "ground_snow", "tint": Color(1, 1, 1), "sky": Color("b7cde0")},
	"beach_road": {"ground": "ground_sand", "tint": Color(1.1, 1.05, 0.95), "sky": Color("7dc0e0")},
	"countryside": {"ground": "ground_grass_flowers", "tint": Color(0.95, 1.05, 0.85), "sky": Color("98c4dc")},
	"night_city": {"ground": "ground_dark", "tint": Color(0.7, 0.72, 0.95), "sky": Color("2c2d52")},
}

var biome: String = "city_center"
var speed: float = 120.0
var _t: float = 0.0
var _cars: Array = []
var _spawn_t: float = 0.0
var _road_y: float = 0.0
var _road_h: float = 300.0
var _rng := RandomNumberGenerator.new()
var _scroll_nodes: Array = []
var _layer_cars: Node2D
var _props: Node2D
var car_ids: Array = []
var enemies_too: bool = true

func setup(b: String, road_y: float, road_h: float = 300.0) -> void:
	biome = b
	_road_y = road_y
	_road_h = road_h
	_rng.randomize()
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	clip_contents = true
	build()

func build() -> void:
	for c in get_children():
		c.queue_free()
	var look: Dictionary = BIOME_LOOK.get(biome, BIOME_LOOK["city_center"])
	var w := get_viewport_rect().size.x
	# ground behind the road
	var ground := TextureRect.new()
	ground.texture = Atlas.tile(look["ground"])
	ground.stretch_mode = TextureRect.STRETCH_TILE
	ground.position = Vector2(0, _road_y - 220)
	ground.size = Vector2(w, _road_h + 440)
	ground.modulate = look["tint"]
	ground.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(ground)
	# road
	var road := TextureRect.new()
	road.texture = Atlas.tile("tile_asphalt_plain")
	road.stretch_mode = TextureRect.STRETCH_TILE
	road.position = Vector2(0, _road_y)
	road.size = Vector2(w, _road_h)
	road.modulate = Color(0.85, 0.85, 0.9) if biome != "night_city" else Color(0.5, 0.5, 0.65)
	road.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(road)
	for yy in [_road_y - 6.0, _road_y + _road_h - 4.0]:
		var edge := ColorRect.new()
		edge.color = Color("e8dcc0")
		edge.position = Vector2(0, yy); edge.size = Vector2(w, 10)
		edge.mouse_filter = Control.MOUSE_FILTER_IGNORE
		add_child(edge)
	# scrolling dashed centre line (two rows of tiles)
	var dash := TextureRect.new()
	dash.name = "dash"
	dash.texture = Atlas.tile("tile_road_dashed_yellow_h")
	dash.stretch_mode = TextureRect.STRETCH_TILE
	dash.position = Vector2(-128, _road_y + _road_h * 0.5 - 64)
	dash.size = Vector2(w + 256, 128)
	dash.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(dash)
	_scroll_nodes.append(dash)
	_props = Node2D.new()
	add_child(_props)
	# props along the top and bottom verge
	var prop_keys := ["prop_tree", "prop_street_lamp", "prop_bush", "prop_hydrant", "prop_bench", "prop_traffic_light", "prop_stop_sign", "prop_trash_can", "prop_barricade_a"]
	if biome == "desert":
		prop_keys = ["prop_rock", "prop_bush_rocks", "prop_stop_sign", "prop_barricade_b"]
	var x := 40.0
	while x < w:
		var k: String = prop_keys[_rng.randi() % prop_keys.size()]
		var s := Atlas.sprite(k, true)
		s.position = Vector2(x, _road_y - 14 - _rng.randf_range(0, 40))
		s.scale = Vector2.ONE * 1.1
		if biome == "night_city":
			s.modulate = Color(0.55, 0.55, 0.75)
		_props.add_child(s)
		x += _rng.randf_range(160, 300)
	_layer_cars = Node2D.new()
	add_child(_layer_cars)
	if car_ids.is_empty():
		car_ids = Data.units.keys()
	for i in 4:
		_spawn_car(_rng.randf_range(0, w))

func _spawn_car(x: float = -200.0) -> void:
	var w := get_viewport_rect().size.x
	var lane := _rng.randi() % 2
	var dir := 1.0 if lane == 1 else -1.0
	var root := Node2D.new()
	var key := ""
	if enemies_too and _rng.randf() < 0.3:
		key = "en_" + Data.enemies.keys()[_rng.randi() % Data.enemies.size()]
	else:
		key = "veh_" + String(car_ids[_rng.randi() % car_ids.size()])
	var shadow := Atlas.sprite("fx_shadow_blob")
	shadow.scale = Vector2(1.6, 0.8); shadow.position = Vector2(0, -6); shadow.modulate = Color(1, 1, 1, 0.7)
	root.add_child(shadow)
	var s := Atlas.sprite(key, true)
	s.scale = Vector2(1.5, 1.5) if lane == 1 else Vector2(1.25, 1.25)
	s.scale.x *= -dir   # sprites face left
	root.add_child(s)
	var ly := _road_y + _road_h * (0.72 if lane == 1 else 0.28) + 30.0
	root.position = Vector2(x if x > -190.0 else (-200.0 if dir > 0 else w + 200.0), ly)
	if x <= -190.0:
		root.position.x = -200.0 if dir > 0 else w + 200.0
	_layer_cars.add_child(root)
	_cars.append({"n": root, "s": s, "v": _rng.randf_range(120, 300) * dir * (1.0 if lane == 1 else 0.8), "ph": _rng.randf() * 6.28, "base": s.scale})
	_layer_cars.move_child(root, -1)

func _process(dt: float) -> void:
	_t += dt
	var w := size.x if size.x > 0 else get_viewport_rect().size.x
	for n in _scroll_nodes:
		n.position.x -= speed * dt
		if n.position.x < -256.0:
			n.position.x += 128.0
	for p in _props.get_children():
		p.position.x -= speed * 0.5 * dt
		if p.position.x < -200:
			p.position.x += w + 400
	var i := _cars.size() - 1
	while i >= 0:
		var c: Dictionary = _cars[i]
		var n: Node2D = c["n"]
		n.position.x += (c["v"] - speed * 0.5) * dt
		var bob := sin(_t * 18.0 * absf(c["v"]) / 200.0 + c["ph"])
		c["s"].position.y = bob * 1.6
		c["s"].rotation = bob * 0.012
		if n.position.x < -300 or n.position.x > w + 300:
			n.queue_free()
			_cars.remove_at(i)
		i -= 1
	_spawn_t -= dt
	if _spawn_t <= 0.0:
		_spawn_t = _rng.randf_range(1.2, 3.0)
		_spawn_car()
