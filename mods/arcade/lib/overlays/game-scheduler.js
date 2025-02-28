const SaitoOverlay = require("./../../../../lib/saito/ui/saito-overlay/saito-overlay");
const SaitoScheduler = require("./../../../../lib/saito/ui/saito-scheduler/saito-scheduler");
const ScheduleInviteTemplate = require("./game-scheduler.template");
const JSON = require("json-bigint");

class GameScheduler {
  constructor(app, mod, invite_tx = null) {
    this.app = app;
    this.mod = mod;
    this.invite_tx = invite_tx;
    this.overlay = new SaitoOverlay(app);
    this.mycallback = null;

    this.app.connection.on("arcade-launch-game-scheduler", (invite_tx = {}) => {
      this.invite_tx = invite_tx;
      console.log(invite_tx);
      this.render();
    });
  }

  render(mycallback = null) {
    if (mycallback != null) {
      this.mycallback = mycallback;
    }
    this.overlay.show(ScheduleInviteTemplate(this.app, this.invite_tx));
    this.attachEvents(mycallback);
  }

  attachEvents(mycallback = null) {
    let scheduler_self = this;

    //
    // create invite now
    //
    document.getElementById("create-invite-now").onclick = (e) => {
      this.overlay.hide();

      this.app.network.propagateTransaction(scheduler_self.invite_tx);
      this.app.connection.emit("relay-send-message", {recipient: scheduler_self.invite_tx.msg.options.desired_opponent_publickey, request: "arcade spv update", data: scheduler_self.invite_tx.transaction});      

      this.mod.addGame(scheduler_self.invite_tx, "open");

      //
      // create invite link from the game_sig
      //
      //mod.showShareLink(scheduler_self.invite_tx.transaction.sig);
    };

    //
    // create future invite
    //
    document.getElementById("create-specific-date").onclick = (e) => {
      /*let txmsg = scheduler_self.invite_tx.returnMessage();

      let title = "Game: " + txmsg.options.game;
      this.overlay.hide();
      let adds = [];
      for (let i = 0; i < scheduler_self.invite_tx.transaction.to.length; i++) {
        let inv = scheduler_self.invite_tx.transaction.to[i];
        if (!adds.includes(inv.add)) {
          adds.push(inv.add);
        }
      }
      let scheduler = new SaitoScheduler(app, mod, {
        date: new Date(),
        tx: scheduler_self.invite_tx,
        title: title,
        adds: adds,
      });
      scheduler.render(() => {
        if (mycallback != null) {
          mycallback();
        }
      });
      */
    };
  }
}

module.exports = GameScheduler;
