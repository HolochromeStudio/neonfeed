extends Node
## Root: owns the layers. Game (autoload) routes screens into `screen_layer`.

func _ready() -> void:
	Game.setup(self)
	Game.go("boot", {}, false)
