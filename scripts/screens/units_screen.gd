extends Screen

func _ready() -> void:
	super._ready()
	UI.paper_bg(self)
	add_child(UI.label("units (todo)", 60, UI.WHITE, true))
	Game.toast("units screen")
