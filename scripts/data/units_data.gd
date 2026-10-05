class_name UnitsData
## The 60 player vehicles. Traits are interpreted by scripts/sim/battle_sim.gd (see TRAIT CATALOG there).
## Ranges are in battlefield pixels (1080 wide field). interval is seconds between attacks at rank 1.

static func _u(id: String, name: String, rar: String, roles: Array, tags: Array, dmg: float, iv: float, rng: float, proj: String, tgt: String, traits: Array, ab: String, ab_desc: String, flavor: String) -> Dictionary:
	return {"id": id, "name": name, "rarity": rar, "roles": roles, "tags": tags, "dmg": dmg, "interval": iv, "range": rng,
		"proj": proj, "target": tgt, "traits": traits, "ability": ab, "ability_desc": ab_desc, "flavor": flavor}

static func build() -> Array:
	var a: Array = []
	# ------------------------------------------------------------------ COMMON
	a.append(_u("taxi", "Taxi", "common", ["DAMAGE"], ["taxi", "car", "transport"], 9, 0.8, 650, "bullet", "first",
		[{"k": "ramp", "per": 0.10, "max": 1.0}], "Meter Running", "Repeated hits on one target raise attack speed (up to +100%).", "The meter never stops. Neither does the driver."))
	a.append(_u("compact", "Compact", "common", ["DAMAGE"], ["car", "compact"], 8, 0.7, 600, "bullet", "first",
		[{"k": "crit", "c": 0.18, "m": 2.2}], "Lucky Parking", "18% chance to crit for x2.2.", "Fits anywhere. Hits everything."))
	a.append(_u("hatchback", "Hatchback", "common", ["DAMAGE"], ["car", "hatch"], 8, 1.0, 650, "bullet", "first",
		[{"k": "pierce", "n": 2}], "Hatch Pop", "Shots punch through up to 2 extra enemies.", "Popped the hatch. Popped the line."))
	a.append(_u("pickup", "Pickup", "common", ["AOE"], ["truck", "pickup", "service"], 16, 1.4, 700, "lob", "first",
		[{"k": "splash", "r": 85, "pct": 0.6}], "Cargo Drop", "Lobs cargo that splashes nearby enemies.", "Whatever was in the bed, it's in the road now."))
	a.append(_u("delivery_van", "Delivery Van", "common", ["ECONOMY", "DAMAGE"], ["delivery", "van"], 8, 1.0, 600, "bullet", "first",
		[{"k": "sp_kill", "n": 1}], "Express Delivery", "Enemies it defeats pay +1 SP.", "Your package has been delivered. To the face."))
	a.append(_u("city_bus", "City Bus", "common", ["BUFFER"], ["bus", "transport"], 5, 1.2, 500, "bullet", "first",
		[{"k": "aura_row", "spd": 0.18}], "Route 7", "Allies in its row attack 18% faster.", "Next stop: everywhere."))
	a.append(_u("scooter", "Scooter", "common", ["DAMAGE"], ["bike", "fast"], 3.4, 0.33, 520, "bullet", "first",
		[{"k": "crit", "c": 0.1, "m": 2.0}], "Zip Zip", "Very rapid, light hits.", "Brrrrrrrrrap!"))
	a.append(_u("family_wagon", "Family Wagon", "common", ["BUFFER"], ["car", "family"], 9, 0.9, 620, "bullet", "first",
		[{"k": "aura_adj", "dmg": 0.12}], "Carpool Mom", "Adjacent allies deal 12% more damage.", "Seatbelts. Snacks. Vengeance."))
	a.append(_u("minivan", "Minivan", "common", ["BUFFER"], ["van", "family"], 7, 1.0, 600, "bullet", "first",
		[{"k": "aura_col", "dmg": 0.15}], "Sliding Door", "Allies in its column deal 15% more damage.", "Spacious. Terrifying."))
	a.append(_u("courier_bike", "Courier Bike", "common", ["ECONOMY"], ["bike", "delivery", "fast"], 5, 0.5, 560, "bullet", "first",
		[{"k": "sp_wave", "n": 3}], "Tips", "Grants +3 SP at the start of each wave.", "Fast delivery, faster tips."))
	# ------------------------------------------------------------------ UNCOMMON
	a.append(_u("tow_truck", "Tow Truck", "uncommon", ["CONTROL"], ["truck", "service", "heavy"], 12, 1.5, 750, "bullet", "strong",
		[{"k": "pull", "d": 170}], "Hook & Haul", "Hooks the strongest enemy and drags it backwards.", "Parked in a no-parking zone? Not anymore."))
	a.append(_u("garbage_truck", "Garbage Truck", "uncommon", ["ECONOMY", "AOE"], ["truck", "service", "heavy"], 11, 1.3, 620, "lob", "first",
		[{"k": "splash", "r": 70, "pct": 0.4}, {"k": "sp_kill", "n": 3}], "Recycling Bonus", "Enemies it defeats pay +3 SP.", "One man's trash is another man's SP."))
	a.append(_u("mail_van", "Mail Van", "uncommon", ["CONTROL"], ["van", "delivery", "service"], 7, 0.9, 640, "bullet", "first",
		[{"k": "stun_hit", "c": 0.16, "d": 0.7}], "Return To Sender", "16% chance to stun for 0.7s.", "Signature required. Impact required."))
	a.append(_u("food_truck", "Food Truck", "uncommon", ["DEBUFFER"], ["food", "truck", "service"], 9, 1.2, 620, "lob", "first",
		[{"k": "status", "st": "burn", "d": 3.0, "c": 0.5}, {"k": "splash", "r": 60, "pct": 0.3}], "Hot Special", "50% chance to set enemies on fire.", "Today's special: heat."))
	a.append(_u("school_bus", "School Bus", "uncommon", ["BUFFER"], ["bus", "transport", "yellow"], 5, 1.4, 500, "bullet", "first",
		[{"k": "aura_tag", "tag": "transport", "dmg": 0.22}], "Field Trip", "Transport allies deal 22% more damage.", "Everybody off! Everybody out!"))
	a.append(_u("street_sweeper", "Street Sweeper", "uncommon", ["CONTROL", "SUPPORT"], ["service", "truck"], 8, 1.0, 560, "bullet", "first",
		[{"k": "push", "d": 45}, {"k": "strip"}, {"k": "cleanse", "every": 6}], "Clean Sweep", "Pushes enemies back, strips enemy shields and cleanses allies.", "Leaves the road spotless. And empty."))
	a.append(_u("road_worker", "Road Worker", "uncommon", ["CONTROL", "SUMMONER"], ["construction", "service"], 6, 1.1, 600, "bullet", "first",
		[{"k": "cone", "every": 7.0, "d": 5.0}], "Cones Out", "Places slowing traffic cones on the road.", "Men at work. Cones at work."))
	a.append(_u("utility_van", "Utility Van", "uncommon", ["AOE"], ["van", "ev", "construction"], 10, 1.0, 650, "bolt", "first",
		[{"k": "chain", "n": 2, "pct": 0.6, "r": 130}], "Live Wire", "Lightning chains to 2 more enemies. Double vs. Wet.", "Caution: high voltage."))
	a.append(_u("electric_taxi", "Electric Taxi", "uncommon", ["DAMAGE"], ["taxi", "ev", "car"], 8, 0.85, 650, "bolt", "first",
		[{"k": "chain", "n": 1, "pct": 1.0, "r": 120}, {"k": "ramp", "per": 0.05, "max": 0.5}], "Silent Fare", "Arcs to a second enemy and gradually speeds up.", "Zero emissions. Total consequences."))
	a.append(_u("shuttle", "Shuttle", "uncommon", ["BUFFER", "ECONOMY"], ["bus", "transport"], 6, 1.0, 560, "bullet", "first",
		[{"k": "aura_row", "dmg": 0.15}, {"k": "sp_wave", "n": 1}], "Airport Run", "Row allies deal 15% more damage; +1 SP per wave.", "Runs every ten minutes. Or never."))
	# ------------------------------------------------------------------ RARE
	a.append(_u("police", "Police", "rare", ["DEBUFFER"], ["police", "emergency", "car"], 12, 0.9, 750, "bullet", "first",
		[{"k": "mark_fast", "spd": 120.0, "d": 4.0}], "Pull Over!", "Marks fast enemies; marked enemies take +30% damage.", "Pull over. Slowly. Or else."))
	a.append(_u("ambulance", "Ambulance", "rare", ["SUPPORT"], ["medical", "emergency", "van"], 5, 1.2, 600, "bullet", "first",
		[{"k": "heal_city", "every": 14.0, "n": 1}, {"k": "shield_ally", "every": 12.0}], "Paramedics", "Heals the city and shields an ally periodically.", "Clear the lane! Clear the lane!"))
	a.append(_u("fire_engine", "Fire Engine", "rare", ["AOE"], ["fire", "emergency", "truck"], 10, 1.1, 640, "lob", "first",
		[{"k": "splash", "r": 115, "pct": 0.8, "st": "wet", "sd": 3.5}], "Hose Down", "Splash soaks enemies (Wet).", "Ladder 5 is on scene."))
	a.append(_u("highway_patrol", "Highway Patrol", "rare", ["DAMAGE"], ["police", "emergency", "car", "fast"], 15, 0.8, 900, "bullet", "fast",
		[{"k": "fast_bonus", "spd": 130.0, "m": 1.9}], "Speed Trap", "Targets the fastest enemy; x1.9 damage vs. fast ones.", "License and registration. Now."))
	a.append(_u("armored_van", "Armored Van", "rare", ["DAMAGE", "SUPPORT"], ["security", "heavy", "van"], 14, 1.3, 640, "bullet", "strong",
		[{"k": "gate", "n": 1}, {"k": "pierce_armor", "pct": 0.35}], "Cash In Transit", "Blocks 1 leak each wave; ignores 35% armor.", "Nothing gets past. Nothing."))
	a.append(_u("construction_truck", "Construction Truck", "rare", ["AOE", "DEBUFFER"], ["construction", "heavy", "truck"], 20, 1.8, 600, "lob", "strong",
		[{"k": "splash", "r": 100, "pct": 1.0, "st": "armor_break", "sd": 4.0}], "Wrecking Pour", "Heavy splash that breaks armor.", "Wet cement. Dry humor."))
	a.append(_u("news_van", "News Van", "rare", ["DEBUFFER", "ECONOMY"], ["media", "van", "tech"], 7, 1.0, 1100, "bullet", "random",
		[{"k": "status", "st": "marked", "d": 5.0, "c": 0.35}, {"k": "sp_kill", "n": 1}], "Breaking News", "Long range. Marks random enemies. +1 SP on kills.", "We interrupt this program for a car chase."))
	a.append(_u("rescue_van", "Rescue Van", "rare", ["SUPPORT"], ["emergency", "medical", "van"], 6, 1.0, 600, "bullet", "first",
		[{"k": "shield_ally", "every": 9.0}, {"k": "aura_adj", "spd": 0.1}], "Safety First", "Shields allies; adjacent allies attack 10% faster.", "Everyone stays safe. Even you."))
	a.append(_u("recovery_truck", "Recovery Truck", "rare", ["CONTROL"], ["truck", "service", "heavy"], 14, 1.6, 700, "bullet", "strong",
		[{"k": "pull", "d": 95}, {"k": "pierce", "n": 2}, {"k": "status", "st": "slow", "d": 2.0, "c": 1.0, "p": 0.3}], "Winch Line", "Pulls up to 3 enemies backward and slows them.", "Even your problems can be towed."))
	a.append(_u("traffic_enforcement", "Traffic Enforcement", "rare", ["CONTROL"], ["police", "service", "car"], 9, 1.0, 650, "bullet", "first",
		[{"k": "stun_pulse", "every": 9.0, "d": 1.2, "r": 520.0}], "Red Light", "Periodically stuns all enemies in range.", "Red means stop. Always."))
	# ------------------------------------------------------------------ EPIC
	a.append(_u("swat_van", "SWAT Van", "epic", ["BURST"], ["police", "emergency", "military", "van"], 15, 0.7, 700, "bullet", "first",
		[{"k": "multi", "n": 2}, {"k": "status", "st": "armor_break", "d": 3.0, "c": 0.3}], "Breach", "Fires at 2 targets; may break armor.", "Knock knock. Don't answer."))
	a.append(_u("monster_truck", "Monster Truck", "epic", ["BURST", "CONTROL"], ["heavy", "truck", "fun"], 30, 1.6, 520, "lob", "first",
		[{"k": "splash", "r": 125, "pct": 0.9}, {"k": "stun_hit", "c": 0.2, "d": 1.0}], "Crush!", "Huge splash; 20% chance to stun.", "Sunday! Sunday! Sunday!"))
	a.append(_u("limousine", "Limousine", "epic", ["ECONOMY", "SUPPORT"], ["luxury", "car"], 10, 1.0, 640, "bullet", "first",
		[{"k": "merge_luck", "c": 0.12}, {"k": "sp_wave", "n": 3}], "VIP Treatment", "While on the board: merges have +12% chance of +1 rank. +3 SP per wave.", "Champagne on the left. Chaos on the right."))
	a.append(_u("riot_truck", "Riot Truck", "epic", ["CONTROL"], ["police", "heavy", "truck"], 12, 1.0, 560, "lob", "first",
		[{"k": "fear", "c": 0.22, "d": 2.2}, {"k": "splash", "r": 100, "pct": 0.5}], "Crowd Control", "Splash with a chance to terrify enemies into retreat.", "Please disperse."))
	a.append(_u("crane_truck", "Crane Truck", "epic", ["BOSS KILLER"], ["construction", "heavy", "truck"], 38, 2.2, 800, "lob", "strong",
		[{"k": "boss", "m": 1.8}, {"k": "splash", "r": 90, "pct": 0.5}], "Wrecking Ball", "x1.8 damage to bosses and elites.", "Swing big or go home."))
	a.append(_u("snowplow", "Snowplow", "epic", ["CONTROL"], ["service", "heavy", "truck", "winter"], 14, 1.2, 560, "wave", "first",
		[{"k": "push", "d": 75, "r": 105}, {"k": "status", "st": "slow", "d": 3.0, "c": 1.0, "p": 0.35}], "Plow Through", "Pushes enemies back and slows them.", "Ploughing through the competition."))
	a.append(_u("race_car", "Race Car", "epic", ["DAMAGE"], ["racing", "fast", "car"], 3.5, 0.18, 700, "bullet", "first",
		[{"k": "crit", "c": 0.06, "m": 2.0}], "Flat Out", "Extremely fast, weak hits - scales with attack-speed buffs.", "Gentlemen, start your engines."))
	a.append(_u("mobile_command", "Mobile Command", "epic", ["BUFFER"], ["military", "tech", "police"], 8, 1.2, 700, "bullet", "first",
		[{"k": "aura_all", "dmg": 0.12, "spd": 0.08}, {"k": "mark_fast", "spd": 100.0, "d": 3.0}], "Command Net", "All allies deal +12% damage and attack +8% faster.", "All units, all units. Move!"))
	a.append(_u("heavy_wrecker", "Heavy Wrecker", "epic", ["CONTROL", "BURST"], ["heavy", "service", "truck"], 26, 2.0, 780, "bullet", "strong",
		[{"k": "pull", "d": 230}, {"k": "status", "st": "armor_break", "d": 4.0, "c": 1.0}], "Mega Hook", "Drags a heavy enemy way back and breaks its armor.", "It can lift a jumbo jet. It prefers cars."))
	a.append(_u("airport_rescue", "Airport Rescue", "epic", ["AOE", "CONTROL"], ["emergency", "fire", "truck"], 12, 1.0, 620, "lob", "first",
		[{"k": "splash", "r": 140, "pct": 0.7, "st": "wet", "sd": 4.0}, {"k": "status", "st": "slow", "d": 2.5, "c": 0.5, "p": 0.3}], "Foam Blanket", "Foam splash soaks and slows.", "Built to put out jumbo-jet fires."))
	# ------------------------------------------------------------------ LEGENDARY
	a.append(_u("presidential_limo", "Presidential Limo", "legendary", ["BUFFER", "ECONOMY"], ["luxury", "military", "car"], 12, 1.0, 700, "bullet", "first",
		[{"k": "aura_all", "dmg": 0.20}, {"k": "gate", "n": 1}, {"k": "merge_luck", "c": 0.1}], "Executive Order", "All allies +20% damage; blocks 1 leak/wave; merges may gain +1 rank.", "Please keep your hands and tentacles inside the vehicle."))
	a.append(_u("prototype_supercar", "Prototype Supercar", "legendary", ["DAMAGE"], ["racing", "tech", "ev", "fast", "car"], 6, 0.22, 780, "bolt", "first",
		[{"k": "ramp", "per": 0.06, "max": 2.0}, {"k": "pierce", "n": 2}], "Overdrive", "Hits pierce and attack speed ramps up to +200%.", "0 to chaos in 2.2 seconds."))
	a.append(_u("heavy_rescue", "Heavy Rescue", "legendary", ["AOE", "SUPPORT"], ["emergency", "heavy", "military", "truck"], 30, 1.5, 700, "lob", "first",
		[{"k": "splash", "r": 125, "pct": 0.8}, {"k": "heal_city", "every": 18.0, "n": 1}, {"k": "shield_ally", "every": 15.0}], "Jaws of Life", "Big splash; heals the city and shields allies.", "When it absolutely, positively has to be un-crumpled."))
	a.append(_u("military_convoy", "Military Convoy", "legendary", ["BURST"], ["military", "heavy", "truck"], 14, 0.9, 760, "bullet", "first",
		[{"k": "multi", "n": 3}, {"k": "rank_proj", "ranks": [4, 6]}], "Escort Fire", "Fires 3 shots at once; +1 target at rank 4 and 6.", "Forward! Forward! Forward!"))
	a.append(_u("experimental_ev", "Experimental EV", "legendary", ["AOE"], ["ev", "tech", "electric"], 14, 0.9, 760, "bolt", "first",
		[{"k": "chain", "n": 4, "pct": 0.7, "r": 150}, {"k": "status", "st": "shock", "d": 2.5, "c": 0.4}], "Arc Reactor", "Lightning chains to 4 enemies and shocks.", "Warranty void if electrocuted."))
	a.append(_u("vintage_hot_rod", "Vintage Hot Rod", "legendary", ["DAMAGE", "DEBUFFER"], ["vintage", "racing", "fire", "car"], 18, 0.9, 700, "bullet", "first",
		[{"k": "status", "st": "burn", "d": 4.0, "c": 1.0}, {"k": "oil_burn"}], "Nitro Burn", "Always ignites; burning Oiled enemies take extra fire.", "Built in '57. Still angry."))
	a.append(_u("golden_taxi", "Golden Taxi", "legendary", ["DAMAGE", "ECONOMY"], ["taxi", "luxury", "car"], 12, 0.7, 700, "bullet", "first",
		[{"k": "ramp", "per": 0.10, "max": 1.5}, {"k": "sp_kill", "n": 2}], "Gold Fare", "Ramping speed; kills pay +2 SP.", "Pay in gold. Always in gold."))
	a.append(_u("interceptor", "Interceptor", "legendary", ["DAMAGE"], ["police", "fast", "tech", "car"], 22, 0.9, 1000, "bullet", "fast",
		[{"k": "fast_bonus", "spd": 110.0, "m": 2.2}, {"k": "mark_fast", "spd": 110.0, "d": 4.0}], "Pursuit Mode", "Hunts the fastest enemy; x2.2 vs. fast targets.", "Nothing outruns it. Nothing."))
	a.append(_u("hyper_bus", "Hyper Bus", "legendary", ["BUFFER"], ["bus", "transport", "tech"], 8, 1.0, 640, "bullet", "first",
		[{"k": "aura_row", "spd": 0.35}, {"k": "aura_col", "dmg": 0.2}], "Express Lane", "Row allies attack +35% faster; column allies +20% damage.", "Express. No stops. No mercy."))
	a.append(_u("elite_fire_engine", "Elite Fire Engine", "legendary", ["AOE", "CONTROL"], ["fire", "emergency", "truck"], 16, 1.0, 700, "lob", "first",
		[{"k": "splash", "r": 150, "pct": 0.9, "st": "wet", "sd": 4.0}, {"k": "pulse", "every": 8.0, "m": 2.5}], "Deluge", "Wet splash plus a periodic screen-wide pulse.", "Flood warning in effect."))
	# ------------------------------------------------------------------ MYTHIC
	a.append(_u("ghost_car", "Ghost Car", "mythic", ["DAMAGE"], ["ghost", "paranormal", "car"], 15, 1.0, 760, "bullet", "strong",
		[{"k": "pierce_armor", "pct": 1.0}], "Phase Shift", "Ignores all armor.", "Nobody remembers who was driving."))
	a.append(_u("time_traveller", "Time Traveller", "mythic", ["CONTROL"], ["tech", "paranormal", "vintage"], 10, 1.1, 800, "bullet", "first",
		[{"k": "rewind", "c": 0.25, "d": 240}], "Rewind", "25% chance to rewind an enemy's movement.", "I've already seen how this ends."))
	a.append(_u("ufo", "UFO", "mythic", ["CONTROL", "DAMAGE"], ["alien", "tech", "paranormal"], 9, 0.6, 1500, "beam", "strong",
		[{"k": "multi", "n": 2}, {"k": "abduct", "every": 12.0}], "Tractor Beam", "Hits 2 targets; abducts the strongest enemy back to the start.", "Take me to your traffic manager."))
	a.append(_u("mecha_vehicle", "Mecha Vehicle", "mythic", ["BURST"], ["tech", "heavy", "military"], 28, 1.1, 700, "bullet", "first",
		[{"k": "crit", "c": 0.25, "m": 2.5}, {"k": "splash", "r": 100, "pct": 0.5}], "Transform!", "Heavy crits with splash.", "Transform and roll out."))
	a.append(_u("possessed_ice_cream_truck", "Possessed Ice Cream Truck", "mythic", ["CONTROL"], ["food", "paranormal", "truck"], 8, 1.0, 620, "wave", "first",
		[{"k": "fear", "c": 0.35, "d": 2.5}, {"k": "status", "st": "slow", "d": 2.0, "c": 1.0, "p": 0.25}], "Haunting Jingle", "Terrifies enemies into retreating; slows nearby.", "Do you hear the music? Do you?"))
	a.append(_u("mini_tank", "Mini Tank", "mythic", ["BURST", "BOSS KILLER"], ["military", "heavy"], 40, 2.0, 900, "lob", "strong",
		[{"k": "splash", "r": 110, "pct": 0.7}, {"k": "status", "st": "armor_break", "d": 4.0, "c": 1.0}, {"k": "boss", "m": 1.4}], "Main Cannon", "Armor-breaking shells, bonus vs. bosses.", "It's small. It's still a tank."))
	a.append(_u("quantum_taxi", "Quantum Taxi", "mythic", ["DAMAGE", "COMBO"], ["taxi", "tech", "paranormal", "car"], 9, 0.6, 700, "bolt", "first",
		[{"k": "dup", "c": 0.30}, {"k": "ramp", "per": 0.05, "max": 0.5}], "Superposition", "30% chance every attack happens twice.", "Both here and there. Charge both."))
	a.append(_u("portal_bus", "Portal Bus", "mythic", ["BUFFER", "COMBO"], ["bus", "transport", "paranormal"], 8, 0.9, 760, "bullet", "first",
		[{"k": "portal", "c": 0.35, "m": 1.0}, {"k": "aura_row", "spd": 0.12}], "Wormhole Route", "35% of attacks reappear from a portal at a random enemy.", "Now boarding: elsewhere."))
	a.append(_u("phantom_ambulance", "Phantom Ambulance", "mythic", ["SUPPORT"], ["medical", "ghost", "emergency", "paranormal"], 6, 1.1, 700, "bullet", "first",
		[{"k": "heal_city", "every": 9.0, "n": 1}, {"k": "shield_ally", "every": 8.0}, {"k": "pierce_armor", "pct": 0.5}], "Ghostly Care", "Frequent heals and shields; shots ignore half of armor.", "Last stop: nowhere."))
	a.append(_u("chrono_police", "Chrono Police", "mythic", ["CONTROL", "DEBUFFER"], ["police", "tech", "paranormal"], 14, 0.9, 850, "bullet", "first",
		[{"k": "rewind", "c": 0.15, "d": 180}, {"k": "mark_fast", "spd": 100.0, "d": 4.0}, {"k": "stun_hit", "c": 0.12, "d": 1.0}], "Time Out", "Rewinds, marks and stuns.", "You are under arrest. Yesterday."))
	return a
