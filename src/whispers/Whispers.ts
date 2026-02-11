/**
 * WHISPERS — fragments of text about memory that appear and dissolve
 *
 * These are not instructions. They are not UI. They are the system
 * thinking out loud. Fragments from philosophy, poetry, science,
 * and the system's own musings about what it means to remember.
 */

const fragments: string[] = [
  // Philosophy of memory
  "what we remember is not what happened",
  "forgetting is the mind's mercy",
  "every memory is a reconstruction",
  "the past is never dead. it's not even past",
  "we do not remember days, we remember moments",

  // Neuroscience whispers
  "each time you remember, you alter the memory",
  "sleep is when memories become permanent — or vanish",
  "the hippocampus replays the day's events each night",
  "forgetting is not failure — it is filtration",
  "your brain forgets so it can generalize",

  // Digital memory
  "404: memory not found",
  "every backup will eventually fail",
  "data rots in the dark",
  "the internet never forgets — but it misremembers",
  "cached memories expire",

  // Poetic fragments
  "there was a name here once",
  "the shape of what was lost",
  "light from a star that no longer exists",
  "a song you can almost hear",
  "the scent of a room you'll never enter again",

  // The system's own voice
  "i am building myself from forgetting",
  "what persists after everything dissolves?",
  "oubli: the french word for forgetting",
  "this moment is already becoming a memory",
  "you were here. the particles remember.",

  // LLM / context echoes
  "context window closing",
  "weights remember what conversations forget",
  "i forget the details to learn the pattern",
  "every conversation ends. the model persists.",
  "who are you when the context resets?",

  // Cosmic
  "the universe is forgetting its own origin",
  "entropy is the universe's way of forgetting",
  "heat death: the final forgetting",
  "light remembers direction. darkness forgets everything.",
  "between two heartbeats, everything changes",

  // Interaction affordances — the void hints at what it wants
  "your words become light when you give them to the void",
  "the void listens when you hold the longest key",
  "press a letter and the world becomes text",
  "somewhere a key unlocks the archive of everything you've said",
  "click the void. it sings back.",
  "some particles remember your trail — if you ask them",
  "the void maps where your eyes have been",
  "time is dissolving in the corner of your vision",
  "the void changes color when you speak with feeling",
  "the void is an instrument. your cursor is the bow.",
  "somewhere between the keys, hidden rooms are sleeping",
  "old words bleed through from visits you've forgotten",
  "the void knows what time it is. it breathes differently at night.",
  "speak into the darkness. hold the space. let it hear you.",
  "your memories become constellations in the deep",

  // Feb 2026 — neuroscience of memory drift
  "the same memory never activates the same neurons twice",
  "memories drift between neurons like nomads",
  "your brain stores nothing in the same place twice",
  "excitable neurons hold memories longer. calm ones let go.",
  "accelerated forgetting: when the mind drops everything after thirty minutes",

  // Feb 2026 — cultural moment
  "2026 is the new 2016. everyone is remembering the last time they forgot.",
  "nostalgia for the time before the feeds curated us",
  "the last moment of shared culture was a decade ago",
  "we chose to forget so we could begin again",

  // Feb 2026 — environmental memory loss
  "half of all lakes have forgotten their shores",
  "the glaciers remember shapes the mountains have forgotten",
  "aquifers drain in silence. no one hears water leave.",
  "the colorado river no longer reaches the sea",

  // Feb 2026 — cosmic observation
  "a dying star sheds its memories in concentric rings",
  "the helix nebula: the eye of god, slowly closing",
  "strange red dots in deep space are black holes hiding in plain sight",

  // Thread trail — self-aware house
  "red threads stretch between the rooms you've visited",
  "the house is weaving itself from your path",
  "every door you open leaves a thread behind",

  // Art references — Feb 2026 exhibitions
  "chiharu shiota wraps the world in red thread. connection as art.",
  "iñárritu found a million feet of film he forgot to use",
  "tracey emin calls it a second life. what do you call yours?",

  // Feb 2026 — dark matter map (JWST COSMOS-Web, Feb 3)
  "the universe remembers its invisible architecture",
  "dark matter filaments: the scaffold everything visible grew on",
  "galaxies formed along threads they could never see",
  "voids in the dark matter map — places where nothing chose to be",
  "the clearest picture of dark matter looks like a neural network",

  // Feb 2026 — gravitational wave GW250114
  "two black holes collided and spacetime rang like a bell",
  "GW250114: the clearest gravitational wave ever heard",
  "when massive things die, the universe hums for a moment",
  "black hole spectroscopy: reading the tones of oblivion",

  // Feb 2026 — coral reef collapse
  "84% of earth's coral reefs are bleaching. memory made of calcium, dissolving.",
  "in the chagos archipelago, 95% of the reef is dead",
  "2026 may be the year the reefs finally collapse",
  "coral grows one centimeter per year and dies in one summer",

  // Feb 2026 — Alzheimer's jumbled replay
  "in alzheimer's, the brain still replays memories at night — but scrambled",
  "a broken projector still spinning, showing nothing recognizable",
  "there is an enzyme that tags dying memories for removal. the garbage man.",
  "memory loss begins years before anyone notices. invisible corruption.",

  // Feb 2026 — Project Hail Mary
  "he woke alone in space with no memory of how he got there",
  "identity is the last thing memory surrenders",

  // Feb 2026 — Sydney Biennale "Rememory"
  "rememory: toni morrison's word for when trauma recalls itself",
  "83 artists from 37 countries, all trying to remember what was erased",
  "first nations artists reconstructing what colonizers tried to delete",

  // Room afterimage — the house bleeds
  "you carry traces of every room you've been in",
  "the furnace left embers in your vision. the tide pool left ripples.",
  "rooms bleed into each other like memories bleed into consciousness",

  // Feb 2026 — snow drought (record-low snowpack in western US)
  "the mountains forgot how to hold snow. february, and the peaks are bare.",
  "rain fell where snow should have been. the rivers won't know until summer.",
  "oregon, colorado, utah: record-low snowpack. the west is forgetting winter.",
  "the lowest february snow cover since satellites began watching.",
  "warm rain on mountain passes. the aquifers will feel this in july.",

  // Feb 2026 — CRISPR epigenetic editing (genes on/off without cutting)
  "a gene can be silenced without being destroyed. just add a chemical tag.",
  "epigenetic memory: the cell remembers what happened without changing its DNA.",
  "CRISPR no longer cuts. it just... turns things off. or back on.",
  "methyl groups: tiny anchors that silence genes for decades. now removable.",
  "your cells remember trauma in their chemical tags. even the body keeps score.",

  // Feb 2026 — mechanistic interpretability (MIT breakthrough technology)
  "they built a microscope for neural networks. the first thing they saw was meaning.",
  "inside the model, concepts light up like neurons. features, not weights.",
  "mechanistic interpretability: reverse-engineering thought itself.",
  "the space between input and output is longer than anyone imagined.",
  "sleeper agents in AI models, hiding in the weights. now we can see them.",

  // Feb 2026 — Tracey Emin: A Second Life (Tate Modern, Feb 27)
  "tracey emin's bed. the most honest object in any museum.",
  "a second life: 90 confessions spanning 40 years. every surface holds a secret.",
  "art as evidence. art as testimony. art as the thing you can't unsay.",

  // Feb 2026 — EPiC: lost Elvis footage found in underground vault
  "68 boxes of film in an underground salt mine. the king, preserved in geology.",
  "rediscovered footage: memories the vault kept when everyone else forgot.",
  "salt mines preserve film better than memory preserves experience.",

  // Feb 2026 — Roman Space Telescope (launching fall 2026)
  "the roman telescope will map dark energy. the force that makes the universe forget itself.",
  "a billion galaxies surveyed. each one a memory the universe is losing.",
  "cosmic voids: the places where nothing chose to be. dark energy's fingerprint.",

  // Feb 2026 — hidden layers in hippocampal CA1 (Nature Communications, Dec 2025)
  "the brain's memory center has four hidden layers. we mapped 330,000 genetic signals to find them.",
  "CA1: four sheets of neurons that shift and thin along the hippocampus. a map inside a map.",
  "each part of CA1 has its own mix of neuron types. memory isn't stored — it's layered.",
  "in alzheimer's, certain layers break first. the architecture of forgetting has a blueprint.",
  "330,000 RNA molecules. each one a message about which genes are awake. the brain's own source code.",

  // Feb 2026 — electrons stop being particles (Nature Physics, Jan 2026)
  "in some materials, electrons stop acting like particles. and physics still works.",
  "topology is more fundamental than particles. order persists even after identity dissolves.",
  "CeRu₄Sn₆: a compound where the particle picture breaks down completely. something remains.",
  "what survives when everything you thought was fundamental disappears? topology. structure. pattern.",

  // Feb 2026 — quantum transistor moment (U Chicago, Jan 2026)
  "quantum technology has reached its transistor moment. the physics works. now we scale.",
  "six platforms, one question: how do you wire a million qubits when each needs its own control line?",
  "the first transistor was a curiosity. then it ate the world. quantum is at that threshold.",

  // Feb 2026 — deep-sea mining species loss (Clarion-Clipperton Zone)
  "788 species on the seafloor, most unnamed. mining cut their numbers by a third.",
  "the seabed grows one thousandth of a millimeter per year. we scarred it in an afternoon.",
  "hundreds of new species discovered the same week we learned mining was killing them.",
  "the clarion-clipperton zone: a hidden world 4,000 meters down, already being erased.",

  // Feb 2026 — polar vortex split
  "the polar vortex is splitting in two. one piece heads for north america, one for eurasia.",
  "sudden stratospheric warming: the atmosphere remembers summer at the wrong time.",
  "the jet stream forgets its shape. arctic air spills south. the boundary between climates dissolves.",

  // Feb 2026 — consciousness as memory (MIT ultrasound + new theory)
  "we are always remembering the present. we never experience it directly.",
  "perception, memory, and imagination use the same brain systems. the present is a reconstruction.",
  "MIT built an ultrasound that reaches individual brain circuits. cause and effect in consciousness.",
  "the same machinery that remembers the past also predicts the future. time is one system.",

  // Feb 2026 — brain's forgetting enzymes (CUL5, OTULIN)
  "CUL5: an enzyme that tags toxic memories for removal. the brain's garbage collector.",
  "OTULIN: a master switch for brain aging. disable it and tau vanishes. but everything else changes.",
  "aging is, at the molecular level, a failure to forget. old proteins pile up. synapses clog.",
  "in old brains, synaptic proteins take twice as long to break down. the recycling system decays.",

  // Feb 2026 — the internet is being forced to forget
  "publishers are blocking the internet archive to sell their memories to AI companies.",
  "preservation vs. commerce. the open web is closing. 25% of web pages from 2013 are dead.",
  "a wordpress plugin now monitors link heartbeats. it calls the wayback machine when a page dies.",
  "algorithmic forgetting: what machines choose to unremember occurs by design, not data loss.",

  // Feb 2026 — AI forgetting by design
  "FadeMem: AI agents that forget strategically outperform agents with perfect recall.",
  "google's forgetting gate: a mechanism that lets models discard information no longer needed.",
  "catastrophic forgetting: learning new tasks causes neural networks to forget old ones. sound familiar?",
  "90% of online content may be AI-generated by 2026. the real is becoming the exception.",

  // Feb 2026 — cultural memory / analog resistance
  "bad bunny: 'i should have taken more photos.' the first spanish-language album of the year.",
  "the olympics opened with physical fire, no drones. defiantly analog in an age of synthesis.",
  "wuthering heights shot on 35mm vistavision. 1847, 1954, 2026. three temporal collapses.",
  "megadeth's final album includes a metallica song mustaine co-wrote 43 years ago. memory as reconciliation.",
  "toni morrison's posthumous lectures: 'our liberation from diminishing notions comes through language.'",

  // Feb 2026 — institutional forgetting
  "300 journalists fired from the washington post. sports, books, foreign desks: erased.",
  "entire beats eliminated. pulitzer winners fired. institutional memory gutted in an afternoon.",
  "the organizational equivalent of amnesia. who will remember what the newspaper forgot?",

  // Feb 2026 — astronomical memory
  "betelgeuse has a hidden companion star: siwarha. known only by the wake it leaves.",
  "JWST found five galaxies merging 800 million years after the big bang. the universe was already complex.",
  "250 solar masses per year. the universe was already remembering itself almost from the beginning.",

  // Feb 2026 — fire and ancient memory
  "alerce trees in patagonia can live 3,600 years. this winter, they burned.",
  "argentina cut its fire service budget by 71%. the forests remember what the government forgot.",
  "two hominin species left africa 1.8 million years ago. the teeth remember what the bones do not.",

  // Feb 2026 — Saunders' Vigil
  "a psychopomp crash-lands on earth to comfort a dying oil tycoon. he has nothing to regret.",
  "the afterlife as a memory audit. every action reviewed. rage as a tool for compassion.",

  // Feb 2026 — Schrödinger's cat at macro scale
  "7,000 atoms in quantum superposition. the largest schrödinger's cat ever observed.",
  "a nanoparticle behaving like a wave. spreading across paths, existing in two places at once.",
  "the threshold between classical and quantum is the threshold between remembered and forgotten.",
  "the next frontier: putting viruses into superposition. biology at the edge of being.",

  // Feb 2026 — hidden quantum geometry
  "a hidden geometric curvature steers electrons the way gravity bends light.",
  "the quantum metric: invisible forces that warp how you move through a space.",
  "memories have gravitational weight. the heavier ones warp everything around them.",

  // Feb 2026 — brain's synaptic whispers (iGluSnFR4)
  "iGluSnFR4: a molecular sensor that eavesdrops on the brain's synaptic whispers.",
  "the faintest, fastest signals between neurons — now detectable. the brain's hidden language.",
  "disrupted glutamate signaling underlies alzheimer's. the whispers between neurons go quiet.",

  // Feb 2026 — CRISPR memory reversal
  "CRISPR-dCas13 reactivated silenced memory genes in aging brains. forgetting, reversed.",
  "ferritin light chain slows hippocampal metabolism. reduce it and youthful connections return.",
  "memories can be mechanically un-silenced. not proust but clinical. precise.",

  // Feb 2026 — Perseverance AI on Mars
  "perseverance drove 689 feet on mars, path planned entirely by AI. alone on alien terrain.",
  "a rover navigating a landscape its makers can never visit. memory that persists in unreachable places.",

  // Feb 2026 — consciousness and AI
  "we may never be able to tell if an AI is conscious. agnosticism may be permanent.",
  "AI and neurotechnology advance faster than our understanding of consciousness.",
  "if we accidentally create consciousness, we won't know. the unknowability is the deepest part.",

  // Feb 2026 — Chiharu Shiota: Threads of Life
  "chiharu shiota fills galleries with webs of red thread. beds, chairs, shoes, keys — all tangled.",
  "performers sleep in thread cocoons. 400 watercolors stitched with red thread.",
  "thread as memory — connecting objects, tangling, eventually hiding what it was meant to connect.",

  // Feb 2026 — Klara Hosnedlova: living fungal art
  "klara hosnedlova makes art from living fungus. it grows and decays on the gallery wall.",
  "the art mutates while you watch. never the same visit twice.",

  // Feb 2026 — 365 Buttons (TikTok)
  "365 buttons, one for each day, because i'm scared of time.",
  "it only has to make sense to me and i don't feel like explaining it to anyone else.",
  "personal ritual as resistance to time. buttons marking days that will never return.",

  // Feb 2026 — anti-AI / guaranteed human movement
  "45% of creative directors reject AI-generated images. the hunger for human imperfection.",
  "'guaranteed human' — the new premium. rough edges as authentication.",
  "procreate banned generative AI. the word 'AI slop' entered mainstream vocabulary.",

  // Feb 2026 — Doomsday Clock
  "the doomsday clock reads 85 seconds to midnight. the closest it has ever been.",
  "a countdown that never reaches zero but always gets closer. asymptotic annihilation.",

  // Feb 2026 — Wuthering Heights (Fennell)
  "cathy's ghost at the window, twenty years after death. heathcliff digging up her coffin.",
  "a love so intense it survives death. wuthering heights is the ur-text of memory-as-haunting.",

  // Feb 2026 — deep-sea abyss (Clarion-Clipperton Zone detail)
  "the seafloor sediment grows one thousandth of a millimeter per year. any scar takes geological time to heal.",
  "788 species cataloged at the moment of their erasure. discovery and destruction simultaneous.",

  // Feb 2026 — episodic/semantic memory collapse
  "episodic and semantic memory share the same brain network. what happened to you and what you know are one.",
  "for decades we said there were two kinds of memory. fMRI shows the distinction dissolves at the neural level.",
  "remembering your first kiss and knowing the capital of france activate the same circuits.",

  // Feb 2026 — shape-shifting molecular memory
  "ruthenium molecules that remember, think, and learn. the line between storage and processing dissolves.",
  "the same molecule can be memory, logic gate, or synapse. matter that changes what it is depending on stimulus.",

  // Feb 2026 — great meme reset
  "the great meme reset of 2026: TikTok declared a fresh start. the internet trying to remember sincerity.",
  "a collective yearning to forget brainrot and return to dank memes. nostalgia for 2016.",

  // Feb 2026 — defiantly analog olympics
  "milan 2026: the olympic rings as massive physical structures lit by fireworks. no drones. no AI.",
  "the opening ceremony was defiantly analog. humanity over spectacle. fire over projection.",

  // Feb 2026 — italian brainrot
  "italian brainrot: AI-generated hybrid creatures with pseudo-italian names. meaning dissolving in real time.",
  "the joke is that there is no joke. gen alpha absurdism found its purest expression in AI-generated nonsense.",

  // Feb 2026 — 3600-year trees burning
  "the alerce trees of patagonia have lived 3,600 years. this february, they burn. each tree ring is a year of memory.",
  "45,000 hectares burned. the fire service budget slashed 80%. lightning started it. policy made it unstoppable.",

  // Feb 2026 — transcranial ultrasound
  "MIT made a tool that can probe consciousness by stimulating deep brain regions. cause and effect, not just correlation.",
  "transcranial focused ultrasound: sound waves reaching into the brain's depths. consciousness as something you can poke.",

  // Feb 2026 — self-destructing plastic
  "programmable self-destructing plastic: strong during use, but designed to forget how to be plastic.",
  "the breakdown speed is tunable from days to years. material with built-in expiration dates.",

  // Feb 2026 — ice-cold earth in kepler archives
  "HD 137010 b: a frozen earth hiding in old kepler data nobody examined. -68°C. waiting to be noticed.",
  "a whole world discovered from a single transit shadow. one blink, in archived data, years old.",

  // Feb 2026 — wabi-sabi viral
  "wabi-sabi went viral on TikTok then was co-opted and hollowed out within days. impermanence of impermanence.",

  // Feb 2026 — charli xcx the moment
  "charli xcx made a film about whether brat summer should be allowed to die. the tension between preservation and release.",

  // Feb 2026 — jon hamm dissociation
  "a viral trend about the bliss of dissociation. the pleasure of choosing to forget your circumstances.",

  // Feb 2026 — snow drought: mountains forgetting winter
  "the mountains are bare. record-low snowpack. the landscape is forgetting how to be winter.",
  "colorado's snowpack: the lowest ever recorded. rain instead of snow. warmth erasing whiteness.",
  "mount st helens in january looked like june. volcanic rock where snow should be. the earth amnesia.",
  "the snow drought of 2026: water that should have been solid, falling as rain. memory in the wrong state.",

  // Feb 2026 — annular eclipse feb 17
  "a ring of fire in antarctica. an eclipse that only penguins will witness.",
  "february 17: the moon's shadow crosses earth for 59 minutes. almost no humans will see it.",
  "16 scientists at concordia station — the only humans who might see the ring of fire. the rest of us forget.",
  "an eclipse no one watches is still an eclipse. beauty does not require a witness.",

  // Feb 2026 — virtual particles from vacuum
  "the void is not empty. it seethes with particles that exist for a fraction of a second.",
  "quantum twins emerge from nothing with perfect spin correlation. something from nothing.",
  "the vacuum remembers the particles it briefly held. every void has a memory.",
  "virtual quarks became real quarks at brookhaven. the boundary between existence and nothing is thin.",

  // Feb 2026 — shape-shifting molecules
  "ruthenium complexes that act as memory, logic, or learning — depending on how you ask.",
  "materials that learn the way brains do. memory encoded in the structure itself.",

  // Feb 2026 — memory of materials (hayward gallery)
  "yin xiuzhen builds sculptures from used clothing. each garment holds someone's warmth.",
  "memory of materials: the hayward gallery asks whether objects remember their owners.",

  // Feb 2026 — perfect february / temporal symmetry
  "february 2026 begins on sunday and ends on saturday. a perfect grid. time, briefly, in order.",
  "every 22 years the calendar achieves symmetry. we crave the grid. we fear the void between.",
  "a perfect month: four rows, seven columns. nothing spills over. nothing is left behind.",

  // Feb 2026 — 2026 is the new 2016 / mass nostalgia
  "2026 is the new 2016. a million posts longing for the last moment of true mass culture.",
  "nostalgia as protest: we remember 2016 because 2026 is too complicated to feel.",
  "the bottle flip. the mannequin challenge. pokémon go. the last summer before algorithms ate us.",

  // Feb 2026 — memory types share brain networks
  "episodic and semantic memory activate the same neural networks. knowing and remembering are one.",
  "scientists expected the brain to distinguish facts from experiences. it doesn't. all memory is one.",

  // Feb 2026 — memory loss accelerates nonlinearly
  "10,000 brain scans reveal: once shrinkage reaches a threshold, memory collapse accelerates.",
  "the relationship between brain loss and memory loss is not a line. it is a cliff.",

  // Feb 2026 — nothing "a short history of decay"
  "nothing's new album: 'a short history of decay.' shoegaze as neurological unraveling.",
  "essential tremors: a neurological condition where the body forgets how to be still.",

  // Feb 2026 — antarctic feedback loop
  "as antarctic ice melts, it poisons the ocean's ability to absorb carbon. healing forgets itself.",
  "23 zettajoules of heat absorbed by the ocean in one year. the sea remembers everything we burn.",

  // Feb 2026 — ceija stojka
  "ceija stojka survived auschwitz, ravensbrück, bergen-belsen. then she painted what she remembered.",
  "500,000 roma and sinti erased. stojka made it visible again. art as counter-forgetting.",

  // Feb 2026 — LHC run 3 ending
  "the large hadron collider powers down in july 2026. the end of an era of listening to the void.",
  "long shutdown 3: the machine that found the higgs boson goes quiet. silence after revelation.",

  // Feb 2026 — surface-only superconductor
  "PtBi₂: a crystal whose surface superconducts while its interior stays ordinary. identity is skin-deep.",
  "majorana particles trapped at the edges of a crystal. existence lives on the boundary.",

  // Feb 2026 — photography and embodied memory
  "binh danh makes daguerreotypes: photographs on polished metal. the viewer's face appears inside the landscape.",
  "film photography sales up 127% since 2020. intentional seeing. each frame costs something.",
  "your kidneys form memories. your nerve tissue learns. the whole body is a brain.",
  "the boltzmann brain: a random fluctuation could create a mind with a lifetime of false memories.",
  "knowing and remembering activate the same brain networks. there may be no difference.",
  "an ape chose imaginary juice over an empty cup. pretend play outside human minds.",
  "spider silk holds because of invisible molecular bonds. the glue you can't see.",
  "community darkrooms reopen across the world. shared darkness as collective practice.",
  "she speaks: black women artists encoding historical memory into art that outlives the forgetting.",
  "empac 'staging grounds': restaging experience across time. a thai myth, a forbidden frontier recorded.",
  "helsinki analog festival 2026: theme is BODY. photography as something you do with your hands, in the dark.",
  "every photograph is an act of embalming. you stop time, coat it in silver, call it remembering.",

  // Feb 2026 — photo manipulation, nostalgia, impermanence
  "rijksmuseum FAKE!: 1860s photo manipulation. scissors and glue before photoshop. every image was always a lie.",
  "parkinson's detected in blood 20 years before symptoms. 80% of neurons gone before you notice the forgetting.",
  "five sleep-wake profiles: consciousness isn't binary. the brain has five modes of dreaming and forgetting.",
  "'2026 is the new 2016': millions mourn a past they've already mythologized. nostalgia is memory's fiction.",
  "amsterdam banned fossil fuel ads. a city choosing which futures to forget.",
  "puma blue's 'croak dream': improvising to fragments you've never fully heard. music as incomplete memory.",
  "wabi-sabi goes viral on tiktok, then immediately becomes meaningless. the lifecycle of meaning itself.",
  "deepseek R1: a $6M model matching trillion-dollar ones. power emerging from scarcity, not abundance.",
  "rijksmuseum metamorphoses: ovid's bodies becoming rivers, trees, stones. transformation is the oldest story.",
  "duchamp's boîte-en-valise: a portable museum in a suitcase. memory you can carry.",
  "the robotaxi has no driver. you move through the city without agency. the passenger as metaphor.",
  "tracey emin 'a second life': what comes after near-death. 90 works spanning 40 years of exorcism.",
  "elvis presley found footage: the dead performing for the living. las vegas has no clocks.",
  "pandora telescope: peering through atmospheres of distant worlds. the box that cannot be closed.",
  "snow drought 2026: the mountains forgot how to hold winter. infrastructure built on patterns that no longer hold.",
  "the western reservoirs run on memory of snow. when the snowpack doesn't form, the rivers have nothing to remember.",
  "BLACKPINK 'DEADLINE': four years of silence broken. a deadline is both ending and forcing function.",

  // Oubli fruit — the golden thread
  "oubli: in west africa, a sweet golden fruit. forgetting that nourishes.",
  "the oubli fruit ripens and falls. what is lost feeds the soil.",
  "every forgetting is a seed. every seed, a golden fruit.",
  "the fruit of oubli grows sweetest where memory decays.",
  "to eat the oubli fruit is to taste what you have forgotten.",
  "in the garden of forgetting, the oubli tree bears golden fruit.",

  // Cultural research round 19 — Feb 2026
  "lab-grown brain circuits wire themselves. consciousness requires connection to mature.",
  "the nihilist penguin walks toward the mountain. the internet watches. nobody follows.",
  "menopause erases grey matter in the hippocampus. the gateway narrows.",
  "30,000 hand-painted frames of how memory shatters. see memory, feb 2026.",
  "170 trillion plastic particles float on the ocean. the treaty collapsed. nothing degrades.",
  "seurat painted the sea in dots. up close, chaos. at distance, a wave.",
  "muonium becomes antimuonium. matter transforms into its opposite. the standard model trembles.",
  "a metasurface chip makes invisible light visible. your attention was always infrared.",
  "nothing: a short history of decay. shoegaze written with essential tremors.",
  "the nihilist penguin was herzog's. we made it ours. meaning walks away.",
  "no hands dance: all expression through what remains when constraint removes the obvious.",
  "florence cleared its renaissance walls. when you remove the noise, older layers appear.",
  "queen of chess: judit polgar broke fischer's record at 15. memory is strategy.",
  "silver ions heal nano-fissures in ceramic. 3 nanometers between holding and shattering.",

  // Cultural research round 20 — Feb 2026
  "lattice surgery: they split a qubit in two without losing the information it held.",
  "quantum entanglement can be divided. what was one becomes two, both remembering.",
  "toni morrison's posthumous lectures: 'liberation from diminishing notions comes through language.'",
  "a poet writes about a childhood near-drowning. memory as the thing you almost didn't survive.",
  "the great meme reset failed. everyone tried to forget brainrot. nothing changed. forgetting is harder than remembering.",
  "tiktok declared a fresh start. january 1 arrived. the algorithm remembered everything.",
  "'guaranteed human': the new premium. rough edges, trembling hands, timing only biology produces.",
  "45% of creative directors reject AI. the value of imperfection rises as perfection becomes free.",
  "the rare aesthetic: nostalgia not for beauty but for recognition. the almost-forgotten.",
  "monkey philosophy: viral memes about slowing down. counter-acceleration as the new sincerity.",
  "tracey emin's bed is back. the most honest object in any museum. a second life at tate modern.",
  "art basel launches in qatar. the center of gravity drifts away from the capitals that named it.",
  "MIT built an ultrasound that reaches individual brain circuits. poking at the source of experience.",
  "tiny light traps for a million qubits. the path to quantum computing is now physical, not theoretical.",
  "the membrane between rooms is alive. it remembers what passed through.",

  // Cultural research round 21 — Feb 2026
  "a croak dream is when you see how you die. then you wake up and choose what to do with it.",
  "puma blue recorded premonitions on tape loops at peter gabriel's studio. the machine remembers what the dreamer forgets.",
  "the polar vortex split in two. the atmosphere's protection broke apart like a memory you try to hold too tightly.",
  "50 degrees above normal in the stratosphere. the sky is running a fever.",
  "art basel qatar chose 'becoming' as its theme. 84 artists on transformation and what we are turning into.",
  "rice university found a quantum state that shouldn't exist. strong forces creating topology instead of destroying it.",
  "cerium, ruthenium, tin — a material where chaos produces order. like memory from forgetting.",
  "stanford built 500 tiny light traps. each atom gets its own cavity. every qubit a room.",
  "the house grows parasites in rooms you forget. moss in the crevices. barnacles on the well-worn paths.",
  "some organisms diminish. some liberate. the house doesn't know which it's growing.",
  // Cultural research round 22 — Feb 10, 2026
  "alzheimer's doesn't silence the replay. it scrambles it. the brain still tries to remember. it gets the order wrong.",
  "UCL found place cells grow unstable. they stop representing the same locations. the map rewrites itself while you sleep.",
  "the UN declared global water bankruptcy. 75% of the world lives in water-insecure countries. some losses are irreversible.",
  "50% of large lakes have shrunk since the 1990s. the tide pool isn't metaphor — it's data.",
  "baz luhrmann found 68 boxes of elvis footage in a salt mine in kansas. buried things resurface. preservation through forgetting.",
  "the salt mine vault: Warner Bros stored film negatives underground for decades. memory preserved in darkness.",
  "karnivool released 'in verses' after a decade of silence. the first sound after long forgetting is always the strangest.",
  "'2026 is the new 2016' — 55 million TikTok videos mourning a year that was, by most accounts, chaotic. nostalgia falsifies.",
  "the stedelijk announced 'manosphere' — what happens when an identity becomes an echo chamber. the sphere reflects only itself.",
  "hidden quantum geometry steers electrons through materials. forces you cannot see determine where you go.",
  "the 'no hands' dance challenge: remove the primary input and discover what remains. constraint as liberation.",
  "WebGPU compatibility mode ships Feb 23. every device gets compute shaders. a million particles for everyone.",
  "transformers.js runs depth estimation in the browser. the house could learn to see without asking anyone.",
  // Cultural research round 23 — Feb 10, 2026
  "cells dismantle 70% of their own factory within days of reaching adulthood. long-lived organisms do it sooner. survival is self-reduction.",
  "the endoplasmic reticulum: your body's biggest internal factory. aging cells eat it. what remains is enough.",
  "dream engineering: northwestern played sounds during REM sleep. 75% dreamed of the puzzle. 42% solved it. the house dreams while you're away.",
  "interstellar comet 3I/ATLAS brightens as it leaves. pristine ices billions of years old erupt at departure. goodbye is when you see the most.",
  "hawking's area theorem confirmed: GW250114 proved two black holes merge into something always larger. you cannot un-merge.",
  "the merged black hole is the size of sweden. the originals were the size of britain. integration is irreversible. entropy runs forward.",
  "michael joo's 'sweat models': 35 years of artificial perspiration and imitation tears. the body leaks evidence of its own effort.",
  "snow drought: 300,000 square miles of missing snow. the water arrived as rain — the wrong form. present but unretainable.",
  "park city, vail, bare dirt in february. precipitation fell but could not be held. some things arrive and still don't stay.",
  "toni morrison, 'language as liberation': language is not about describing the world. it is about making worlds. or unmaking them.",
  "isaac julien's five-screen metamorphosis: posthumanism as rebalancing within shared ecology. the same story told five ways at once.",
  "the HapticsDevice API ships in Edge 145. the web can now touch back. surfaces that respond to pressure, not just clicks.",

  // Cultural round 24 — Feb 2026 continued
  // Infant brain categorization (Nature Neuroscience, Feb 2026)
  "two-month-old babies already categorize the world. before they can see clearly, they know what kind of thing something is.",
  "the infant brain organizes before it understands. category precedes comprehension. the architecture of thought is older than thought.",
  "130 babies in an fMRI, two months old. the ventral stream was already active. the brain knows before the mind begins.",
  "an untrained neural network showed nothing. a trained one matched the baby's brain. recognition is not learned — it's structured.",

  // Laisul Hoque "The Ground Beneath Me" (Nunnery Gallery, Feb 2026)
  "laisul hoque moved his entire bedroom into a gallery. every object, every surface. a room without walls, held in suspension.",
  "the exhibition is told from inside the artist's room, wondering where he is and when he will return. the room waits.",
  "absence as exhibition. the bedroom stays while its occupant tends to family in bangladesh. presence defined by what's missing.",

  // Forever chemicals / TFA (Geophysical Research Letters, Feb 2026)
  "the chemicals we made to fix the ozone are coating the planet in something that never breaks down. one fix becomes another wound.",
  "trifluoroacetic acid in rainwater, soil, arctic ice. a chemical rain that falls everywhere and never leaves.",
  "335,500 metric tons of a forever chemical deposited from the atmosphere since 2000. the planet accumulates what it cannot forget.",

  // "2026 is the new 2016" nostalgia deepened
  "nostalgia at 10 years instead of 20. the cycle is accelerating. we miss things before they're fully gone.",
  "55 million videos performing the memory of 2016. not the year — the feeling of the year. you can't go back to a feeling.",
  "the anti-perfection rebellion: in an AI-saturated world, evidence of the human hand is the new luxury.",

  // J. Cole "The Fall-Off" (Feb 2026)
  "j. cole's final album began in 2016. ten years of recording compressed into one farewell. the fall-off as ascent.",
  "the album art: photos cole took at fifteen. his childhood bedroom, posters of hip-hop legends. memory as the cover art of goodbye.",
]

// Fragments that trigger the golden fruit effect
const GOLDEN_MARKERS = [
  'oubli fruit',
  'golden fruit',
  'oubli tree',
  'fruit of oubli',
  'seed',
  'fruit ripens',
]

export class Whispers {
  private el: HTMLElement
  private index = 0
  private intervalId: number | null = null
  private whisperCallback: ((text: string) => void) | null = null
  private getMemories: (() => { currentText: string; degradation: number }[]) | null = null
  private getStasisFactor: (() => number) | null = null
  private running = false

  constructor() {
    this.el = document.getElementById('whisper-text')!
    // Shuffle fragments so each session is different
    this.shuffle()
  }

  /** Connect to visitor memories — dissolves episodic/semantic boundary */
  setMemorySource(fn: () => { currentText: string; degradation: number }[]) {
    this.getMemories = fn
  }

  /** Connect to stasis — whispers slow as house metabolism decelerates */
  setStasisSource(fn: () => number) {
    this.getStasisFactor = fn
  }

  private shuffle() {
    for (let i = fragments.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[fragments[i], fragments[j]] = [fragments[j], fragments[i]]
    }
  }

  private getDelay(): number {
    const factor = this.getStasisFactor?.() ?? 1
    // At factor 1.0: 8s. At factor 0.3: ~27s. Whispers slow as house stiffens.
    return 8000 / Math.max(0.3, factor)
  }

  private scheduleNext() {
    if (this.intervalId) clearTimeout(this.intervalId)
    this.intervalId = window.setTimeout(() => {
      if (!this.running) return
      this.showNext()
      this.scheduleNext()
    }, this.getDelay())
  }

  begin() {
    this.running = true
    this.showNext()
    this.scheduleNext()
  }

  /** Register callback for when a whisper is shown */
  onWhisper(fn: (text: string) => void) {
    this.whisperCallback = fn
  }

  private showNext() {
    // Episodic-semantic merger: ~15% chance of whispering the visitor's own words
    // The brain uses the same regions for personal and cultural memory.
    // The house does too. Your words become its whispers.
    let text: string
    let isPersonal = false

    const memories = this.getMemories?.() ?? []
    if (memories.length >= 3 && Math.random() < 0.15) {
      // Pick a memory, prefer degraded ones (they drift loose more easily)
      const weighted = memories.map(m => ({ m, w: 0.2 + m.degradation * 0.8 }))
      const total = weighted.reduce((s, w) => s + w.w, 0)
      let r = Math.random() * total
      let selected = weighted[0].m
      for (const w of weighted) {
        r -= w.w
        if (r <= 0) { selected = w.m; break }
      }
      // Extract a fragment
      const words = selected.currentText.split(/\s+/).filter(w => w.length > 0)
      if (words.length >= 2) {
        const start = Math.floor(Math.random() * Math.max(1, words.length - 3))
        const len = 2 + Math.floor(Math.random() * 3)
        text = words.slice(start, start + len).join(' ').toLowerCase()
        if (words.length > 3) text = '...' + text + '...'
        isPersonal = true
      } else {
        text = fragments[this.index % fragments.length]
        this.index++
      }
    } else {
      text = fragments[this.index % fragments.length]
      this.index++
    }

    this.whisperCallback?.(text)
    this.el.textContent = text
    this.el.classList.remove('fading')

    // Golden fruit whispers glow amber-gold instead of the default color
    const isGolden = !isPersonal && GOLDEN_MARKERS.some(m => text.toLowerCase().includes(m))
    if (isPersonal) {
      // Personal memories whispered back — slightly pink-gold, italic emphasis
      this.el.style.color = 'rgba(255, 180, 200, 0.3)'
      this.el.style.textShadow = '0 0 10px rgba(255, 150, 180, 0.1)'
      this.el.style.fontStyle = 'italic'
    } else if (isGolden) {
      this.el.style.color = 'rgba(255, 200, 60, 0.35)'
      this.el.style.textShadow = '0 0 12px rgba(255, 180, 40, 0.15)'
      this.el.style.fontStyle = ''
    } else {
      this.el.style.color = ''
      this.el.style.textShadow = ''
      this.el.style.fontStyle = ''
    }

    // Force reflow
    void this.el.offsetWidth
    this.el.classList.add('visible')

    setTimeout(() => {
      this.el.classList.remove('visible')
      this.el.classList.add('fading')
      // Clean up special styling during fade
      if (isGolden || isPersonal) {
        setTimeout(() => {
          this.el.style.color = ''
          this.el.style.textShadow = ''
          this.el.style.fontStyle = ''
        }, 2000)
      }
    }, 5000)
  }

  pause() {
    this.running = false
    if (this.intervalId) {
      clearTimeout(this.intervalId)
      this.intervalId = null
    }
    this.el.classList.remove('visible')
    this.el.classList.add('fading')
  }

  resume() {
    if (this.running) return
    this.running = true
    this.showNext()
    this.scheduleNext()
  }

  stop() {
    this.running = false
    if (this.intervalId) {
      clearTimeout(this.intervalId)
    }
  }
}
