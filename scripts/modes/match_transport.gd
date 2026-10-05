class_name MatchTransport
extends RefCounted
## Transport abstraction for multiplayer modes. A transport moves small JSON messages between two peers:
##   {t:"hello", name, rating, deck}  {t:"state", wave, hp, units, enemies, lead}  {t:"send", enemy, n}
##   {t:"emote", id}                  {t:"input", a:{...}}   (co-op lockstep inputs)   {t:"end", result}
## Implementations: LoopbackTransport (tests), BotRivalPeer / BotPartnerPeer (offline simulation, see bot_peers.gd),
## WebSocketTransport (online relay; same message schema).
signal connected
var inbox: Array = []

func open() -> void:
	connected.emit()

func send(_msg: Dictionary) -> void:
	pass

## Called every frame by the match adapter. Offline peers simulate here.
func tick(_dt: float) -> void:
	pass

func poll() -> Array:
	var out := inbox
	inbox = []
	return out

func close() -> void:
	pass

# ---------------------------------------------------------------------------------------------- loopback (tests)
class Loopback extends MatchTransport:
	var peer: MatchTransport
	static func pair() -> Array:
		var a := Loopback.new()
		var b := Loopback.new()
		a.peer = b
		b.peer = a
		return [a, b]
	func send(msg: Dictionary) -> void:
		peer.inbox.append(JSON.parse_string(JSON.stringify(msg)))   # round-trip through JSON like a real socket

# ---------------------------------------------------------------------------------------------- websocket relay
class WebSocket extends MatchTransport:
	var ws := WebSocketPeer.new()
	var url: String = ""
	var _was_open: bool = false
	func open_url(u: String) -> int:
		url = u
		return ws.connect_to_url(u)
	func send(msg: Dictionary) -> void:
		if ws.get_ready_state() == WebSocketPeer.STATE_OPEN:
			ws.send_text(JSON.stringify(msg))
	func tick(_dt: float) -> void:
		ws.poll()
		if ws.get_ready_state() == WebSocketPeer.STATE_OPEN and not _was_open:
			_was_open = true
			connected.emit()
		while ws.get_available_packet_count() > 0:
			var m: Variant = JSON.parse_string(ws.get_packet().get_string_from_utf8())
			if typeof(m) == TYPE_DICTIONARY:
				inbox.append(m)
	func close() -> void:
		ws.close()
