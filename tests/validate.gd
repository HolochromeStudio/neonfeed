extends Node
func _ready() -> void:
	var errs := ContentValidator.run()
	get_tree().quit(1 if errs.size() > 0 else 0)
