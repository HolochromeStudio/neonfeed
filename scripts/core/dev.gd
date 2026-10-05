extends Node
## Developer tools: command-line automation + in-game dev menu.
##   --shot=PATH       save a screenshot then quit (use with --frames=N, default 30)
##   --goto=SCREEN     jump to a screen after boot (home, map, units, battle ...)
##   --args=k:v,k:v  (deck uses + as separator)    screen args for --goto
##   --dev             open dev menu enabled (backtick or 4-finger tap)
## All of these are no-ops in normal play.

var enabled: bool = false
var shot_path: String = ""
var frames_left: int = 30
var goto_screen: String = ""
var goto_args: Dictionary = {}
var god_mode: bool = false
var show_fps: bool = false
var fps_label: Label
var menu: Control
var script_steps: Array = []
var _frame: int = 0
var _booted: bool = false
var _perf_n: int = 0
var _perf_proc: float = 0.0
var _perf_phys: float = 0.0
var _perf_max_nodes: int = 0
var _perf_max_dc: int = 0
var _perf_worst: float = 0.0
var perf: Dictionary = {}

func perf_add(k: String, usec: int) -> void:
	perf[k] = int(perf.get(k, 0)) + usec

func _ready() -> void:
	for a in OS.get_cmdline_user_args() + OS.get_cmdline_args():
		if a.begins_with("--shot="):
			shot_path = a.substr(7)
		elif a.begins_with("--frames="):
			frames_left = int(a.substr(9))
		elif a.begins_with("--goto="):
			goto_screen = a.substr(7)
		elif a.begins_with("--args="):
			for kv in a.substr(7).split(","):
				var p := kv.split(":")
				if p.size() == 2:
					goto_args[p[0]] = p[1]
		elif a.begins_with("--save="):
			Save.PATH = "user://" + a.substr(7)
			Save.load_game()
		elif a == "--dev":
			enabled = true
		elif a == "--fresh":
			Save.reset_all()
		elif a.begins_with("--steps="):
			script_steps = a.substr(8).split(";")
	if OS.is_debug_build():
		enabled = true

func _process(_dt: float) -> void:
	_frame += 1
	if Game.screen_name != "boot":
		var pt := Performance.get_monitor(Performance.TIME_PROCESS) * 1000.0
		_perf_n += 1
		_perf_proc += pt
		_perf_worst = maxf(_perf_worst, pt)
		_perf_max_nodes = maxi(_perf_max_nodes, int(Performance.get_monitor(Performance.OBJECT_NODE_COUNT)))
		_perf_max_dc = maxi(_perf_max_dc, int(Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME)))
	if shot_path != "" and Game.screen_name != "boot":
		if not _booted:
			_booted = true
			frames_left = frames_left
		frames_left -= 1
		if frames_left <= 0:
			var img := get_viewport().get_texture().get_image()
			img.save_png(shot_path)
			print("[dev] screenshot saved: ", shot_path, " (", img.get_width(), "x", img.get_height(), ")")
			for k in perf:
				print("[perf] %s avg_ms=%.2f" % [k, float(perf[k]) / 1000.0 / maxf(1, _perf_n)])
			print("[perf] frames=%d avg_process_ms=%.2f worst_process_ms=%.2f max_nodes=%d max_draw_calls=%d" % [_perf_n, _perf_proc / maxf(1, _perf_n), _perf_worst, _perf_max_nodes, _perf_max_dc])
			get_tree().quit()
	if show_fps and fps_label:
		fps_label.text = "%d FPS  %d nodes" % [Engine.get_frames_per_second(), int(Performance.get_monitor(Performance.OBJECT_NODE_COUNT))]

func _unhandled_input(ev: InputEvent) -> void:
	if enabled and ev is InputEventKey and ev.pressed and ev.keycode == KEY_QUOTELEFT:
		toggle_menu()

func toggle_menu() -> void:
	if menu and is_instance_valid(menu):
		menu.queue_free(); menu = null
		return
	menu = DevMenu.new()
	Game.overlay.add_child(menu)

func set_show_fps(v: bool) -> void:
	show_fps = v
	if v and fps_label == null:
		fps_label = Label.new()
		fps_label.position = Vector2(10, 4)
		fps_label.add_theme_font_size_override("font_size", 28)
		fps_label.add_theme_color_override("font_color", Color.YELLOW)
		fps_label.add_theme_constant_override("outline_size", 6)
		fps_label.add_theme_color_override("font_outline_color", Color.BLACK)
		Game.overlay.add_child(fps_label)
	elif not v and fps_label:
		fps_label.queue_free(); fps_label = null
