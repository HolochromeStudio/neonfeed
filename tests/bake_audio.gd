extends Node
## Bakes the procedural SFX/music into assets/audio/*.wav (run once after changing audio.gd):
##   godot --headless --path . res://tests/bake_audio.tscn
func _ready() -> void:
	Audio.bake_to(ProjectSettings.globalize_path("res://assets/audio"))
	print("baked audio")
	get_tree().quit()
