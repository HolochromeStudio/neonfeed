class_name SynergyData
## Tag-driven synergies. Counting rule: number of DEPLOYED vehicles carrying the tag (or, for 'mix' synergies, distinct tags present).
## tiers: [{n: required, name, desc, fx: {...}}] fx keys are interpreted by BattleSim._recompute_synergies

static func build() -> Array:
	return [
		{"id": "taxi", "name": "Taxi Rank", "tag": "taxi", "tiers": [
			{"n": 3, "name": "TAXI RANK", "desc": "Taxis +20% attack speed.", "fx": {"tag_spd": 0.20}},
			{"n": 5, "name": "RUSH SERVICE", "desc": "Taxis +45% attack speed and +25% damage.", "fx": {"tag_spd": 0.45, "tag_dmg": 0.25}}]},
		{"id": "first_responders", "name": "First Responders", "mix": ["police", "fire", "medical"], "tiers": [
			{"n": 3, "name": "FIRST RESPONDERS", "desc": "Emergency units +25% damage; city heals 1 per 2 waves.", "fx": {"target_tag": "emergency", "tag_dmg": 0.25, "city_regen_waves": 2}}]},
		{"id": "public_transport", "name": "Public Transport", "mix": ["bus", "taxi", "delivery"], "tiers": [
			{"n": 3, "name": "PUBLIC TRANSPORT", "desc": "Transport units +20% damage; +1 SP per wave.", "fx": {"target_tag": "transport", "tag_dmg": 0.20, "sp_wave": 1}}]},
		{"id": "road_crew", "name": "Road Crew", "tag": "construction", "tiers": [
			{"n": 2, "name": "ROAD CREW", "desc": "Construction units +25% damage.", "fx": {"tag_dmg": 0.25}},
			{"n": 4, "name": "UNION BREAK", "desc": "Construction +25% more and splash +20%.", "fx": {"tag_dmg": 0.25, "aoe": 0.20}}]},
		{"id": "old_school", "name": "Old School", "tag": "vintage", "tiers": [
			{"n": 2, "name": "OLD SCHOOL", "desc": "Vintage units +35% damage.", "fx": {"tag_dmg": 0.35}}]},
		{"id": "electric_grid", "name": "Electric Grid", "tag": "ev", "tiers": [
			{"n": 2, "name": "ELECTRIC GRID", "desc": "EV chains +1 target and +20% damage.", "fx": {"tag_dmg": 0.20, "chain_extra": 1}},
			{"n": 4, "name": "POWER SURGE", "desc": "EV chains +2 targets, shocks always last longer.", "fx": {"tag_dmg": 0.30, "chain_extra": 2, "status_d": 0.3}}]},
		{"id": "heavy_metal", "name": "Heavy Metal", "tag": "heavy", "tiers": [
			{"n": 3, "name": "HEAVY METAL", "desc": "Heavy units +30% damage vs. bosses.", "fx": {"target_tag": "heavy", "boss": 0.30}},
			{"n": 5, "name": "IRON FIST", "desc": "Heavy units +25% damage and +10% armor pierce.", "fx": {"target_tag": "heavy", "tag_dmg": 0.25, "pierce": 0.10}}]},
		{"id": "speed_demons", "name": "Speed Demons", "tag": "fast", "tiers": [
			{"n": 3, "name": "SPEED DEMONS", "desc": "Fast units +25% attack speed.", "fx": {"tag_spd": 0.25}}]},
		{"id": "police_force", "name": "Police Force", "tag": "police", "tiers": [
			{"n": 2, "name": "BACKUP", "desc": "Police +15% damage; Marked +10% more damage.", "fx": {"tag_dmg": 0.15, "marked": 0.10}},
			{"n": 4, "name": "ALL UNITS", "desc": "Police +30% damage, crit +10%.", "fx": {"tag_dmg": 0.30, "crit": 0.10}}]},
		{"id": "fire_dept", "name": "Fire Department", "tag": "fire", "tiers": [
			{"n": 2, "name": "FIRE DEPT", "desc": "Fire splash +20% wider; Wet lasts longer.", "fx": {"aoe": 0.2, "status_d": 0.3}}]},
		{"id": "paranormal", "name": "Paranormal Activity", "tag": "paranormal", "tiers": [
			{"n": 2, "name": "UNEXPLAINED", "desc": "Paranormal units +25% damage.", "fx": {"tag_dmg": 0.25}},
			{"n": 3, "name": "POLTERGEIST", "desc": "Paranormal +25% more; 10% chance attacks ignore armor.", "fx": {"tag_dmg": 0.25, "pierce": 0.15}}]},
		{"id": "luxury", "name": "High Society", "tag": "luxury", "tiers": [
			{"n": 2, "name": "HIGH SOCIETY", "desc": "+25% SP from kills.", "fx": {"sp_kill": 0.25}}]},
		{"id": "service", "name": "City Services", "tag": "service", "tiers": [
			{"n": 3, "name": "CITY SERVICES", "desc": "Service units +20% damage; control lasts 25% longer.", "fx": {"target_tag": "service", "tag_dmg": 0.20, "status_d": 0.25}}]},
		{"id": "military", "name": "Armed Forces", "tag": "military", "tiers": [
			{"n": 3, "name": "ARMED FORCES", "desc": "Military +30% damage; +10% armor pierce.", "fx": {"tag_dmg": 0.30, "pierce": 0.10}}]},
		{"id": "delivery", "name": "Express Network", "tag": "delivery", "tiers": [
			{"n": 2, "name": "EXPRESS NETWORK", "desc": "Delivery units pay +2 SP per wave.", "fx": {"sp_wave": 2}}]},
		{"id": "bus_line", "name": "Bus Line", "tag": "bus", "tiers": [
			{"n": 2, "name": "BUS LINE", "desc": "Bus auras are 50% stronger.", "fx": {"aura_mult": 0.5}}]},
		{"id": "winter", "name": "Winter Service", "tag": "winter", "tiers": [
			{"n": 1, "name": "SALTED ROADS", "desc": "Slow effects are 30% stronger.", "fx": {"slow_p": 0.3}}]},
		{"id": "tech", "name": "Tech Stack", "tag": "tech", "tiers": [
			{"n": 3, "name": "TECH STACK", "desc": "Tech units +20% attack speed.", "fx": {"tag_spd": 0.20}},
			{"n": 5, "name": "SINGULARITY", "desc": "Tech units +30% damage too.", "fx": {"tag_dmg": 0.30}}]},
		{"id": "family", "name": "Family Trip", "tag": "family", "tiers": [
			{"n": 2, "name": "FAMILY TRIP", "desc": "Family auras +30% stronger; +5 city HP.", "fx": {"aura_mult": 0.3, "city_hp": 5}}]},
	]
