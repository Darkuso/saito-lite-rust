
    this.importFaction('faction2', {
      id		:	"faction2" ,
      key		:	"england" ,
      name		: 	"English",
      nickname		: 	"English",
      img		:	"england.png",
      capitals		:	["london"],
      cards_bonus	:	1,
      marital_status    :       0,
      returnCardsSaved  :       function(game_mod) {

        let base = 0;

        if (game_mod.game.state.leaders_henry_viii == 1) { base += 1; }
        if (game_mod.game.state.leaders_edward_vi == 1) { base += 1; }
        if (game_mod.game.state.leaders_mary_i == 1) { base += 1; }
        if (game_mod.game.state.leaders_elizabeth_i == 1) { base += 2; }

        return base;

      },
      returnCardsDealt  :	function(game_mod) {

        let kc = game_mod.returnNumberOfKeysControlledByFaction("england");
        let base = 0;

	switch (kc) {
	  case 1: { base = 1; break; }
	  case 2: { base = 1; break; }
	  case 3: { base = 2; break; }
	  case 4: { base = 2; break; }
	  case 5: { base = 3; break; }
	  case 6: { base = 3; break; }
	  case 7: { base = 4; break; }
	  case 8: { base = 4; break; }
	  case 9: { base = 5; break; }
	  case 10: { base = 5; break; }
	  case 11: { base = 6; break; }
	  case 12: { base = 6; break; }
	  default: { base = 1; break; }
	}

	// bonuses based on leaders
	if (game_mod.game.state.leaders_henry_viii == 1) { base += 1; }
	if (game_mod.game.state.leaders_edward_vi == 1) { base += 0; }
	if (game_mod.game.state.leaders_mary_i == 1) { base += 0; }
	if (game_mod.game.state.leaders_elizabeth_i == 1) { base += 2; }

	// TODO - bonus for home spaces under protestant control
	return base;

      },
      calculateVictoryPoints  :	function(game_mod) {

        let kc = game_mod.returnNumberOfKeysControlledByFaction("england");
        let base = this.vp;

	switch (kc) {
	  case 1: { base += 2; break; }
	  case 2: { base += 3; break; }
	  case 3: { base += 4; break; }
	  case 4: { base += 5; break; }
	  case 5: { base += 6; break; }
	  case 6: { base += 7; break; }
	  case 7: { base += 8; break; }
	  case 8: { base += 9; break; }
	  case 9: { base += 10; break; }
	  case 10: { base += 11; break; }
	  case 11: { base += 12; break; }
	  case 12: { base += 13; break; }
	  default: { base += 14; break; }
	}

	if (game_mod.game.state.schmalkaldic_league == 1) {
          base += game_mod.returnNumberOfElectoratesControlledByCatholics();
	}

	return base;

      },
    });
 

