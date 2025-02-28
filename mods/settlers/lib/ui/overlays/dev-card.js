const DevCardOverlayTemplate = require("./dev-card.template");
const SaitoOverlay = require("./../../../../../lib/saito/ui/saito-overlay/saito-overlay");

class DevCardOverlay {

  constructor(app, mod) {
    this.app = app;
    this.mod = mod;
    this.overlay = new SaitoOverlay(this.app, this.mod, false);
    this.limit = null;
  }

  render() {

    this.limit = Math.min(
      this.mod.game.deck[0].hand.length,
      this.mod.game.state.players[this.mod.game.player - 1].devcards
    );

    this.overlay.show(DevCardOverlayTemplate(this.app, this.mod, this));
    this.attachEvents();
  }

  attachEvents() {
    this_dev_card = this;
    document.querySelectorAll(".settlers-dev-card").forEach((card) => {
      card.onclick = (e) => {

        let target = e.currentTarget;
        let card = target.getAttribute("id");
        let cardobj = this_dev_card.mod.game.deck[0].cards[this_dev_card.mod.game.deck[0].hand[card]];

        this_dev_card.overlay.remove();


        switch (cardobj.action) {
          case 1: //Soldier/Knight
            this_dev_card.mod.game.state.canPlayCard = false; //No more cards this turn
            this_dev_card.mod.addMove(
              `play_knight\t${this_dev_card.mod.game.player}\t${cardobj.card}`
            );
            this_dev_card.mod.endTurn();
            break;
          case 2:
            // this_dev_card.mod.playYearOfPlenty(
            //   this_dev_card.mod.game.player,
            //   cardobj.card
            // );

            this_dev_card.mod.year_of_plenty.player = this_dev_card.mod.game.player;
            this_dev_card.mod.year_of_plenty.cardname = cardobj.card; 
            this_dev_card.mod.year_of_plenty.render();
            //this_dev_card.mod.game.state.canPlayCard = false; //No more cards this turn
            break;
          case 3:
            this_dev_card.mod.monopoly.player = this_dev_card.mod.game.player;
            this_dev_card.mod.monopoly.cardname = cardobj.card;
            this_dev_card.mod.monopoly.render();
            //this_dev_card.mod.playMonopoly(this_dev_card.mod.game.player, cardobj.card);
            //this_dev_card.mod.game.state.canPlayCard = false; //No more cards this turn
            break;
          case 4:
            this_dev_card.mod.game.state.canPlayCard = false; //No more cards this turn
            this_dev_card.mod.addMove(
              "player_build_road\t" + this_dev_card.mod.game.player
            );
            this_dev_card.mod.addMove(
              "player_build_road\t" + this_dev_card.mod.game.player
            );
            this_dev_card.mod.addMove(
              `road_building\t${this_dev_card.mod.game.player}\t${cardobj.card}`
            );
            this_dev_card.mod.endTurn();
            break;
          default:
            //victory point
            this_dev_card.mod.addMove(
              `vp\t${this_dev_card.mod.game.player}\t${cardobj.card}`
            );
            this_dev_card.mod.endTurn();
        }
        this_dev_card.mod.removeCardFromHand(this_dev_card.mod.game.deck[0].hand[card]);
        

      };
    });

  }

}

module.exports = DevCardOverlay;

