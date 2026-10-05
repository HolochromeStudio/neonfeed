extends Node
## Procedural audio: every SFX and both music loops are synthesised at boot (no audio files needed).
## Hooks: Audio.sfx("merge"), Audio.music("battle"), Audio.haptic(ms). Unit audio defs are derived in unit_audio().

const RATE := 22050
var _sfx: Dictionary = {}
var _music: Dictionary = {}
var _players: Array[AudioStreamPlayer] = []
var _music_player: AudioStreamPlayer
var _next: int = 0
var _cur_music: String = ""
var ready_done: bool = false
var _rng := RandomNumberGenerator.new()

func _ready() -> void:
	_rng.seed = 7
	for i in 10:
		var p := AudioStreamPlayer.new()
		add_child(p)
		_players.append(p)
	_music_player = AudioStreamPlayer.new()
	add_child(_music_player)

var _build_queue: Array = []
var _build_total: int = 0

## Cooperative synthesis: call build_step() once per frame from the boot screen; returns progress 0..1.
func build_step() -> float:
	if ready_done:
		return 1.0
	if _build_queue.is_empty() and _build_total == 0:
		for k in _sfx_defs():
			_build_queue.append(k)
		_build_queue.append("@menu")
		_build_queue.append("@battle")
		_build_total = _build_queue.size()
	var k: String = _build_queue.pop_front()
	match k:
		"@menu": _music["menu"] = _make_music(false)
		"@battle": _music["battle"] = _make_music(true)
		_: _sfx[k] = _make(_sfx_defs()[k])
	if _build_queue.is_empty():
		ready_done = true
		apply_volumes()
		return 1.0
	return 1.0 - float(_build_queue.size()) / float(_build_total)

func build_all() -> void:
	while build_step() < 1.0:
		pass

func apply_volumes() -> void:
	if _music_player:
		_music_player.volume_db = linear_to_db(maxf(0.0001, float(Save.setting("music")) * 0.55)) if Save.data.has("settings") else -8.0

func sfx(name: String, pitch: float = 1.0, vol_db: float = 0.0) -> void:
	if not _sfx.has(name) or not Save.data.has("settings"):
		return
	var v := float(Save.setting("sfx"))
	if v <= 0.01:
		return
	var p := _players[_next]
	_next = (_next + 1) % _players.size()
	p.stream = _sfx[name]
	p.pitch_scale = pitch
	p.volume_db = vol_db + linear_to_db(v)
	p.play()

func music(name: String) -> void:
	if name == _cur_music:
		return
	_cur_music = name
	if name == "" or not _music.has(name):
		_music_player.stop()
		return
	_music_player.stream = _music[name]
	apply_volumes()
	_music_player.play()

func haptic(ms: int = 20) -> void:
	if Save.data.has("settings") and Save.setting("haptics") and OS.has_feature("mobile"):
		Input.vibrate_handheld(ms)

## Unit audio definition (data-driven by projectile kind + rarity pitch).
func unit_audio(id: String) -> Dictionary:
	var u: Dictionary = Data.units[id]
	var shoot: String = {"bullet": "shot", "lob": "lob", "bolt": "zap", "beam": "beam", "wave": "wave"}.get(u["proj"], "shot")
	var pitch := 0.85 + 0.06 * float(Data.RARITIES.find(u["rarity"])) + float(hash(id) % 20) * 0.006
	return {"shoot": shoot, "pitch": pitch, "hit": "hit", "spawn": "deploy"}

# ------------------------------------------------------------------ synthesis
func _make(fn: Dictionary) -> AudioStreamWAV:
	var dur: float = fn["dur"]
	var n := int(dur * RATE)
	var data := PackedByteArray()
	data.resize(n * 2)
	var ph := 0.0
	var ph2 := 0.0
	var lp := 0.0
	var kind: String = fn["kind"]
	for i in n:
		var t := float(i) / RATE
		var u := t / dur
		var env := _env(fn, t, u)
		var f: float = lerpf(float(fn["f0"]), float(fn["f1"]), pow(u, float(fn.get("curve", 1.0))))
		if fn.has("vib"):
			f *= 1.0 + 0.04 * sin(t * float(fn["vib"]) * TAU)
		ph += f / RATE
		var s := 0.0
		match kind:
			"sine": s = sin(ph * TAU)
			"square": s = 1.0 if fmod(ph, 1.0) < 0.5 else -1.0; s *= 0.55
			"saw": s = (fmod(ph, 1.0) * 2.0 - 1.0) * 0.6
			"tri": s = (absf(fmod(ph, 1.0) * 4.0 - 2.0) - 1.0)
			"noise":
				var nz := _rng.randf() * 2.0 - 1.0
				lp += (nz - lp) * float(fn.get("lp", 0.5))
				s = lp
			"mix":
				var nz2 := _rng.randf() * 2.0 - 1.0
				lp += (nz2 - lp) * float(fn.get("lp", 0.4))
				s = sin(ph * TAU) * 0.6 + lp * float(fn.get("nz", 0.5))
			"arp":
				var notes: Array = fn["notes"]
				var idx := mini(int(u * notes.size()), notes.size() - 1)
				ph2 += float(notes[idx]) / RATE
				s = sin(ph2 * TAU) * 0.7 + sin(ph2 * TAU * 2.0) * 0.2
				env = _env(fn, t, fmod(u * notes.size(), 1.0) * 0.4 + 0.0) * (1.0 - u * 0.3)
		var v := clampi(int(s * env * float(fn.get("gain", 0.5)) * 32767.0), -32767, 32767)
		data.encode_s16(i * 2, v)
	var w := AudioStreamWAV.new()
	w.format = AudioStreamWAV.FORMAT_16_BITS
	w.mix_rate = RATE
	w.data = data
	return w

func _env(fn: Dictionary, t: float, u: float) -> float:
	var a: float = fn.get("atk", 0.005)
	var d: float = fn.get("dec", 3.0)
	if t < a:
		return t / a
	return exp(-(t - a) * d * (1.0 / maxf(0.05, float(fn["dur"]))) * 1.0) if fn.get("exp", true) else maxf(0.0, 1.0 - u)

func _sfx_defs() -> Dictionary:
	return {
		"click": {"kind": "sine", "dur": 0.07, "f0": 900, "f1": 600, "dec": 6, "gain": 0.35},
		"back": {"kind": "sine", "dur": 0.09, "f0": 600, "f1": 380, "dec": 6, "gain": 0.35},
		"deploy": {"kind": "mix", "dur": 0.38, "f0": 70, "f1": 190, "dec": 2.0, "atk": 0.02, "nz": 0.6, "lp": 0.15, "gain": 0.5},
		"brake": {"kind": "noise", "dur": 0.16, "f0": 100, "f1": 100, "dec": 5, "lp": 0.7, "gain": 0.25},
		"pop": {"kind": "sine", "dur": 0.14, "f0": 420, "f1": 90, "dec": 6, "gain": 0.55},
		"merge": {"kind": "arp", "dur": 0.42, "f0": 1, "f1": 1, "notes": [523, 659, 784, 1047], "dec": 2.5, "gain": 0.5},
		"merge_big": {"kind": "arp", "dur": 0.7, "f0": 1, "f1": 1, "notes": [392, 523, 659, 784, 1047, 1319], "dec": 2.0, "gain": 0.55},
		"shot": {"kind": "mix", "dur": 0.09, "f0": 700, "f1": 280, "dec": 5, "nz": 0.7, "lp": 0.5, "gain": 0.28},
		"lob": {"kind": "sine", "dur": 0.22, "f0": 260, "f1": 80, "dec": 4, "gain": 0.45},
		"zap": {"kind": "square", "dur": 0.14, "f0": 1500, "f1": 320, "dec": 5, "gain": 0.22},
		"beam": {"kind": "sine", "dur": 0.2, "f0": 900, "f1": 1100, "vib": 30, "dec": 2, "gain": 0.25},
		"wave": {"kind": "mix", "dur": 0.3, "f0": 200, "f1": 120, "dec": 3, "nz": 0.8, "lp": 0.12, "gain": 0.4},
		"hit": {"kind": "noise", "dur": 0.05, "f0": 100, "f1": 100, "dec": 6, "lp": 0.6, "gain": 0.3},
		"crit": {"kind": "sine", "dur": 0.3, "f0": 1500, "f1": 1450, "dec": 5, "gain": 0.4},
		"kill": {"kind": "sine", "dur": 0.16, "f0": 300, "f1": 70, "dec": 5, "gain": 0.5},
		"boom": {"kind": "noise", "dur": 0.55, "f0": 100, "f1": 100, "dec": 3.5, "lp": 0.09, "gain": 0.85},
		"coin": {"kind": "arp", "dur": 0.2, "f0": 1, "f1": 1, "notes": [988, 1319], "dec": 3, "gain": 0.4},
		"levelup": {"kind": "arp", "dur": 0.7, "f0": 1, "f1": 1, "notes": [523, 659, 784, 1047, 784, 1047], "dec": 2, "gain": 0.5},
		"error": {"kind": "square", "dur": 0.2, "f0": 160, "f1": 110, "dec": 3, "gain": 0.3},
		"whoosh": {"kind": "noise", "dur": 0.3, "f0": 100, "f1": 100, "atk": 0.12, "dec": 2.5, "lp": 0.2, "gain": 0.3},
		"stamp": {"kind": "mix", "dur": 0.18, "f0": 130, "f1": 70, "dec": 6, "nz": 0.6, "lp": 0.2, "gain": 0.7},
		"horn": {"kind": "square", "dur": 0.38, "f0": 330, "f1": 330, "dec": 1.5, "atk": 0.02, "gain": 0.35},
		"gong": {"kind": "sine", "dur": 1.0, "f0": 130, "f1": 120, "vib": 5, "dec": 3, "gain": 0.65},
		"win": {"kind": "arp", "dur": 1.1, "f0": 1, "f1": 1, "notes": [523, 523, 523, 659, 523, 659, 784, 1047], "dec": 1.5, "gain": 0.5},
		"lose": {"kind": "arp", "dur": 0.9, "f0": 1, "f1": 1, "notes": [392, 349, 330, 262], "dec": 1.5, "gain": 0.5},
		"growl": {"kind": "mix", "dur": 0.9, "f0": 60, "f1": 45, "vib": 18, "dec": 1.8, "nz": 0.9, "lp": 0.1, "gain": 0.7},
		"siren": {"kind": "square", "dur": 0.6, "f0": 700, "f1": 950, "vib": 3, "dec": 1.0, "gain": 0.2},
		"tick": {"kind": "sine", "dur": 0.03, "f0": 1800, "f1": 1800, "dec": 6, "gain": 0.2},
		"unlock": {"kind": "arp", "dur": 0.55, "f0": 1, "f1": 1, "notes": [659, 784, 988, 1319], "dec": 2, "gain": 0.45},
		"shield": {"kind": "sine", "dur": 0.25, "f0": 500, "f1": 900, "dec": 4, "gain": 0.3},
		"heal": {"kind": "arp", "dur": 0.4, "f0": 1, "f1": 1, "notes": [660, 880, 1100], "dec": 3, "gain": 0.3},
	}

func _make_music(battle: bool) -> AudioStreamWAV:
	var bpm := 132.0 if battle else 104.0
	var beat := 60.0 / bpm
	var bars := 8
	var dur := beat * 4.0 * bars
	var n := int(dur * RATE)
	var data := PackedByteArray()
	data.resize(n * 2)
	var prog: Array = [[0, 4, 7], [5, 9, 12], [7, 11, 14], [3, 7, 10]] if not battle else [[0, 3, 7], [8, 12, 15], [5, 8, 12], [7, 10, 14]]
	var root := 110.0 if battle else 131.0
	var mel_scale: Array = [0, 2, 4, 7, 9, 12, 14, 16] if not battle else [0, 3, 5, 7, 10, 12, 15, 17]
	var mr := RandomNumberGenerator.new()
	mr.seed = 4242 if battle else 99
	var melody: Array = []
	for i in bars * 8:
		melody.append(mel_scale[mr.randi() % mel_scale.size()] if mr.randf() < 0.65 else -1)
	var ph_b := 0.0
	var ph_m := 0.0
	var ph_c := [0.0, 0.0, 0.0]
	for i in n:
		var t := float(i) / RATE
		var bt := t / beat
		var bar := int(bt / 4.0) % bars
		var chord: Array = prog[bar % 4]
		var s := 0.0
		# bass: root on beats
		var bf := root * 0.5 * pow(2.0, float(chord[0]) / 12.0)
		var benv := exp(-fmod(bt, 1.0) * 4.0)
		ph_b += bf / RATE
		s += (fmod(ph_b, 1.0) * 2.0 - 1.0) * 0.18 * benv
		# chord stabs on offbeats
		var coff := fmod(bt, 1.0)
		var cenv := exp(-coff * 6.0) if int(bt) % 2 == 1 else 0.0
		for k in 3:
			ph_c[k] += root * pow(2.0, float(chord[k]) / 12.0) / RATE
			s += (1.0 if fmod(ph_c[k], 1.0) < 0.5 else -1.0) * 0.045 * cenv
		# melody 8ths
		var mi := int(bt * 2.0) % melody.size()
		var mnote: int = melody[mi]
		if mnote >= 0:
			var mf := root * 2.0 * pow(2.0, float(mnote) / 12.0)
			var menv := exp(-fmod(bt * 2.0, 1.0) * 3.5)
			ph_m += mf / RATE
			s += sin(ph_m * TAU) * 0.12 * menv
		# percussion
		var kick := exp(-fmod(bt, 1.0) * 14.0) * sin(TAU * 55.0 * fmod(bt, 1.0) * 0.5) * 0.25 if battle or int(bt) % 2 == 0 else 0.0
		var hat := (_rng.randf() * 2.0 - 1.0) * 0.05 * exp(-fmod(bt * 2.0, 1.0) * 14.0)
		s += kick + hat
		data.encode_s16(i * 2, clampi(int(s * 32767.0 * 0.7), -32767, 32767))
	var w := AudioStreamWAV.new()
	w.format = AudioStreamWAV.FORMAT_16_BITS
	w.mix_rate = RATE
	w.data = data
	w.loop_mode = AudioStreamWAV.LOOP_FORWARD
	w.loop_begin = 0
	w.loop_end = n
	return w
