class_name StoryData
## Dialogue + cutscene scripts. Line: [speaker, mood, text]. Speakers map to atlas keys npc_<speaker> / the player doll.
## moods: neutral happy angry worried surprised think point

static func build() -> Dictionary:
	return {
		"cast": {
			"cop": {"name": "Officer Dana", "art": "npc_traffic_cop"},
			"mayor": {"name": "Mayor Pennywhistle", "art": "npc_mayor"},
			"mechanic": {"name": "Gus the Mechanic", "art": "npc_mechanic"},
			"reporter": {"name": "Rita Reel", "art": "npc_news_reporter"},
			"crew": {"name": "Hardhat Hank", "art": "npc_construction"},
			"courier": {"name": "Dex the Courier", "art": "npc_delivery_guy"},
			"rival": {"name": "Vince Vortex", "art": "npc_rival_driver"},
			"stranger": {"name": "???", "art": "npc_mysterious_stranger"},
			"dog": {"name": "Biscuit", "art": "npc_animal_dog"},
			"player": {"name": "You", "art": ""},
			"narrator": {"name": "", "art": ""},
		},
		"intro_panels": [
			{"cut": "cut_panel_1", "text": "It was a normal day in the city...", "pan": "right"},
			{"cut": "cut_panel_2", "text": "...until the traffic went wrong.", "pan": "left"},
			{"cut": "cut_panel_3", "text": "Now it's up to you to set things right.", "pan": "zoom"},
			{"cut": "cut_panel_4", "text": "But who is behind the Jam?", "pan": "zoom"},
		],
		"scenes": _scenes(),
	}

static func _scenes() -> Dictionary:
	var s := {}
	s["welcome"] = [
		["mayor", "worried", "Thank goodness you're here! Every light in the city turned green. At the SAME TIME."],
		["mayor", "angry", "Cars are driving in circles. Buses are driving in squares. Nobody knows what a roundabout is anymore!"],
		["cop", "neutral", "Officer Dana, Traffic Division. Mayor says you're the new Dispatcher. Congratulations. Sorry."],
		["cop", "point", "Your job: deploy vehicles, merge them into bigger ones, and keep the Jam out of the city."],
		["player", "surprised", "Me? I just came to renew a parking permit..."],
		["mayor", "happy", "Perfect! Fresh eyes! Officer Dana will show you the ropes."],
	]
	s["tutorial_start"] = [
		["cop", "neutral", "Rule one: tap DEPLOY. A random vehicle from your deck will pull into a free slot."],
	]
	s["tutorial_deploy"] = [["cop", "point", "Nice! Deploying costs SP. The more you deploy, the pricier it gets. Deploy a few more!"]]
	s["tutorial_merge"] = [["cop", "happy", "Two matching vehicles of the same rank? Drag one onto the other to MERGE. The result can be ANY vehicle in your deck."]]
	s["tutorial_upgrade"] = [["cop", "point", "Between waves you'll pick a run upgrade. Choose wisely - they stack into something wild."]]
	s["tutorial_end"] = [
		["cop", "happy", "Not bad, Dispatcher! You've got the knack."],
		["mechanic", "neutral", "Hey! Gus the Mechanic. Garage is open - build your deck, customise your look, the works."],
		["cop", "worried", "The Jam started downtown. Time to head to City Center."],
	]
	var ch := {
		1: {
			"pre": [["crew", "angry", "Road work's blocked. Somebody put orange cones EVERYWHERE. Even where there's no road."],
				["cop", "think", "That's not an accident. Something is steering these vehicles."], ["reporter", "happy", "Rita Reel, Channel 5! Smile for the camera, Dispatcher - you're live!"]],
			"boss": [["stranger", "neutral", "Little cars. Little plans. Meet Big Bertha."], ["cop", "worried", "A monster truck?! Hold the line!"]],
			"post": [["crew", "happy", "Roads open! Well, 'open' is a strong word. But they're not on fire."], ["reporter", "surprised", "Wait - the footage shows a hooded figure on the overpass!"]]},
		2: {
			"pre": [["courier", "worried", "Dex the Courier! My packages are going in circles in the suburbs. Whole cul-de-sacs are stuck!"],
				["dog", "happy", "Woof!"], ["courier", "happy", "That's Biscuit. He's very good at traffic."]],
			"boss": [["reporter", "surprised", "A helicopter - that's MY news chopper! Who stole it?!"], ["stranger", "neutral", "Whirlybird, circle them."]],
			"post": [["courier", "happy", "Delivered! Everything. Finally."], ["cop", "think", "Whoever's behind this knows how traffic works. Better than we do."]]},
		3: {
			"pre": [["rival", "neutral", "Vince Vortex. Fastest driver on the Highway. You must be the 'Dispatcher'."], ["rival", "angry", "Don't get in my lane."],
				["cop", "angry", "Vince, this isn't a race!"], ["rival", "happy", "Everything is a race."]],
			"boss": [["stranger", "neutral", "General Gridlock, advance."], ["rival", "surprised", "That's a TANK! On MY highway?!"]],
			"post": [["rival", "happy", "...Fine. You're not bad. I'll race you later."], ["rival", "think", "But I saw that hooded guy. He's connected to the city's signal control."]]},
		4: {
			"pre": [["mechanic", "worried", "The Industrial District's cranes are moving on their own. Something is hacking the machines."],
				["crew", "angry", "Containers stacked across the road, nobody to blame..."]],
			"boss": [["stranger", "neutral", "Dig."], ["mechanic", "surprised", "A drill truck! Watch the ground!"]],
			"post": [["mechanic", "think", "I found a transmitter in the wreck. It's sending... green light signals."], ["cop", "point", "Signal control. He's controlling the lights!"]]},
		5: {
			"pre": [["reporter", "worried", "Strange lights over the desert. Visitors? Tourists? Traffic?"], ["cop", "neutral", "If it flies, it's still subject to traffic law."]],
			"boss": [["stranger", "neutral", "From beyond the Jam, a friend."], ["reporter", "surprised", "A UFO! THIS IS NOT A DRILL!"]],
			"post": [["cop", "happy", "Unidentified, but not unticketed."], ["stranger", "neutral", "You are better than I expected, Dispatcher."]]},
		6: {
			"pre": [["crew", "worried", "Snow Town's frozen solid. The plows keep plowing... into each other."], ["mechanic", "think", "Something's controlling them. Something big."]],
			"boss": [["stranger", "angry", "MECHA-JAM, awaken."], ["cop", "surprised", "That's no vehicle... that's a robot!"]],
			"post": [["mechanic", "happy", "We did it! ...Why do I hear laughing?"], ["stranger", "neutral", "That was only the prototype."]]},
		7: {
			"pre": [["rival", "happy", "Beach Road! Sun, sand, and speed. Race you to the pier!"], ["cop", "worried", "Vince, the traffic is jammed solid."], ["rival", "neutral", "Then we un-jam it. Together."]],
			"boss": [["stranger", "neutral", "Big Bertha has returned. Louder."], ["rival", "angry", "Not on my beach!"]],
			"post": [["rival", "happy", "Partners?"], ["player", "happy", "Partners."]]},
		8: {
			"pre": [["courier", "worried", "The Countryside! Tractors are blocking everything. Biscuit's scared of the windmill."], ["dog", "worried", "Whine..."]],
			"boss": [["stranger", "neutral", "Bruno, harvest them."], ["courier", "surprised", "That drill is the size of a barn!"]],
			"post": [["cop", "think", "That's every district but one. Night City. He's waiting there."], ["mayor", "worried", "Be careful. The whole city is counting on you."]]},
		9: {
			"pre": [["mayor", "worried", "This is it. Night City. Every light is green. Every road is jammed."], ["cop", "neutral", "We're all with you, Dispatcher."], ["reporter", "happy", "Channel 5 is live. Don't mess up."]],
			"boss": [["stranger", "angry", "I am the Dispatcher the city deserves. Every light, every lane - MINE."], ["player", "angry", "Not anymore!"], ["stranger", "neutral", "MECHA-JAM, final form!"]],
			"post": [["stranger", "worried", "No... the signal... the lights..."], ["cop", "happy", "Lights are back to normal! Red, yellow, green. In order!"],
				["mayor", "happy", "The city is saved! And the permit is renewed, by the way."], ["player", "happy", "Small cars, big chaos. Let's go again!"]]},
	}
	for k in ch:
		s["ch%d_pre" % k] = ch[k]["pre"]
		s["ch%d_boss" % k] = ch[k]["boss"]
		s["ch%d_post" % k] = ch[k]["post"]
	s["rival_pvp"] = [["rival", "happy", "Ready for a race, Dispatcher? Same traffic, same seed. Best board wins."]]
	s["coop_intro"] = [["cop", "neutral", "Partner up! Two boards, one city. Keep the traffic out together."]]
	s["survival_intro"] = [["cop", "worried", "Survival mode: no end in sight. Boss every 10 waves. How long can you last?"]]
	return s
