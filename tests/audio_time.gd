extends Node
func _ready() -> void:
	var t0 := Time.get_ticks_msec()
	Audio.build_all()
	print("audio build ms=", Time.get_ticks_msec() - t0)
	get_tree().quit()
