/*********************************************************************************
 GAME MODULE - QUEUE

 This is a general parent class for modules that wish to implement Game logic. It
 introduces underlying methods for creating games via email invitations, and sending
 and receiving game messages over the Saito network. The module also includes random
 number routines for dice and deck management. Thanks for the Web3 Foundation for its
 support developing code that allows games to interact with cryptocurrency tokens and
 Polkadot parachains.

 This module attempts to use peer-to-peer connections with fellow gamers where
 possible in order to avoid the delays associated with on-chain transactions. All
 games should be able to fallback to using on-chain communications however. Peer-
 to-peer connections will only be used if both players have a proxymod connection
 established.

 Developers please note that every interaction with a random dice and or processing
 of the deck requires an exchange between machines, so games that do not have more
 than one random dice roll per move and/or do not require constant dealing of cards
 from a deck are easier to implement on a blockchain than those which require
 multiple random moves per turn.

 HOW IT WORKS

 We recommend new developers check out the WORDBLOCKS game for a quick introduction
 to how to build complex games atop the Saito Game Engine. Essentially, games require
 developers to manage a "stack" of instructions which are removed one-by-one from
 the main stack, updating the state of all players in the process.

 MINOR DEBUGGING NOTE

 core functionality from being re-run -- i.e. DECKBACKUP running twice on rebroadcast
 or reload, clearing the old deck twice. What this means is that if the msg.extra
 data fields are used to communicate, they should not be expected to persist AFTER
 core functionality is called like DEAL or SHUFFLE. etc. An example of this is in the
 Twilight Struggle headline code.

**********************************************************************************/
let saito = require("./../saito/saito");

class GameQueue {

  //
  // most games over-ride
  //
  handleGameLoop() {
    return 0;
  }

  //
  // this function prepares the game for any moves that are receives, including
  // preparing the UI. if it is NOT run then the queue is not executed and we should
  // not process new moves.
  //
  async initializeGameQueue(game_id) {

    //
    // sanity load (multiplayer)
    //
    if (!this.game || this.game.id !== game_id) {
      console.info("Loading game in InitializeGameQueue!");
      this.loadGame(game_id);
    }

    //
    // proactively initialize HTML so that the HUD
    // and other graphical elements exist for the game
    // queue to manipulate. we should not initialize the
    // display multiple times, which is why render(app) 
    // does the init check.
    //
    this.render(this.app);
    this.attachEvents(this.app);

    if (this.game.status != "") {
      this.updateStatus(this.game.status);
    }

    //
    // quit if already initialized, or not first time initialized
    //
    if (this.game.initialize_game_run == 1 && this.initialize_game_run == 1) {
      return 0;
    } else {
      this.game.initialize_game_run = 1;
      this.initialize_game_run = 1;
    }

    this.initializeDice(); // Make sure we have dice before initializing the game

    //Implicit crypto staking for all games (if included in the options)
    if (this.game.options?.crypto) {
      this.game.stake = this.game.options.stake ? parseFloat(this.game.options.stake) : 0;
      this.game.crypto = this.game.options.crypto || "";
    }

    this.initializeGame(game_id);

    //
    // if game is over, don't run queue
    //
    if (this.game.over == 1) { return 0; }

    //
    // FEB 12 - disabling causes init on receiver so reduce to earliest step
    //
    if (this.game.step.game < 2) {
      this.saveGame(this.game.id);
    }

    //
    // and start running the queue
    //
    this.startQueue();

    return 1;
  }

  startQueue() {

    if (this.hasGameMovePending() && this.game?.initializing == 0) {
      this.updateStatus('Rebroadcasting Last Move');
      console.info("Should not start processing QUEUE because we have pending TXs");
      this.gaming_active = 0;
      return 0;
    }

    if (this.runQueue() == 0) {

      if (this.game.player == 0 && this.browser_active) {
        if (this.game.live && this.game.step.game >= this.game.live){
          this.observerControls.pause();
          this.game.live = 0;
        }

        if (this.observerControls.is_paused) {
          this.game.halted = 1;
        } else {
          setTimeout(() => {
            if (this.processFutureMoves() == 0) {
              //Try to download new moves
              console.info("Checking DB for missed future moves");
              this.observerControls.next();
            }
          }, this.observerControls.step_speed);
          return;
        }
      }

      this.processFutureMoves();
    }
  }

  restartQueue() {

    if (this.gaming_active) {
      console.warn("Queue Already active, not restarting...");
      return;
    }

    // save so we continue from AFTER this point...
    console.info(`Restarting queue (${this.game.halted}): ` + JSON.stringify(this.game.queue));
    this.game.halted = 0;
    this.saveGame(this.game.id);

    //Process remaining moves in my queue
    //When we get to a stop point, check on all the future moves that had come in
    if (this.runQueue() == 0) {
      this.processFutureMoves();
    }
  }

  runQueue() {

    let game_self = this;
    let cont = 1;
    let loops_through_queue = 0;
    let queue_length = 0;
    let last_instruction = "";


    // I want to experiment with moving this to game-defined commands
    // So the UI can "pause" the screen but allow game engine commands to execute in the background
    // i.e. it only halts the game for UI updates
    if (this.game.halted === 1) {
      console.info("Don't start process queue while halted");
      return -1;
    }

    this.gaming_active = 1; // prevents future moves from getting added to the queue while it is processing

    //stash a copy of state before doing anything
    this.game_state_pre_move = JSON.parse(JSON.stringify(game_self.game));

    //
    // loop through the QUEUE (game stack)
    //
    console.info("START QUEUE: " + JSON.stringify(game_self.game.queue));

    while (game_self.game.queue.length > 0 && cont == 1) {

      console.info("LATEST: " + game_self.game.queue[game_self.game.queue.length - 1]);

      if (loops_through_queue >= 100 && queue_length == game_self.game.queue.length && last_instruction === game_self.game.queue[queue_length - 1]) {
        console.warn("ENDLESS QUEUE LOOPING");
        return -1;
      }

      let gqe = game_self.game.queue.length - 1;
      let gmv = game_self.game.queue[gqe].split("\t");

      loops_through_queue++;
      queue_length = game_self.game.queue.length;
      last_instruction = game_self.game.queue[gqe];

      //Update the clock each time we process something automatically (so shuffling doesn't count against us)
      this.time.last_received = new Date().getTime();

      //Check each of our game engine commands if anything triggers on gmv[0]
      for (let i = 0; i < game_self.commands.length; i++) {
        if (game_self.commands[i](game_self, gmv) === 0) { //Game engine requests queue processing pauses
          console.info("I AM PLAYER: " + game_self.game.player);
          console.info("GAME ENGINE STOPS FOR " + JSON.stringify(gmv));
          console.info("OUTSTANDING QUEUE: " + JSON.stringify(game_self.game.queue));
          return 0;
        }
      }
      //if (this.game.player == 0) {
      //  if (this.game.deck?.length > 0) console.log(JSON.parse(JSON.stringify(this.game.deck[0])));
      //  if (this.game.pool?.length > 0) console.log(JSON.parse(JSON.stringify(this.game.pool[0])));
      //}

      //
      // we have not removed anything, so throw it to the game module to process the move
      //
      if (
        queue_length == game_self.game.queue.length &&
        cont == 1 &&
        last_instruction === game_self.game.queue[queue_length - 1]
      ) {
        cont = this.handleGameLoop();
      }

    }

    console.info("PAUSING QUEUE: " + JSON.stringify(game_self.game.queue));
    return 0;
  }


  initializeQueueCommands() {

    this.commands = [];

    this.commands.push((game_self, gmv) => {
      if (gmv[0] === "SETVAR") {
        if (gmv[1]) {
          if (gmv[3]) {
            if (gmv[4]) {
              if (gmv[5]) {
                game_self.game[gmv[1]][gmv[2]][gmv[3]][gmv[4]] = gmv[5];
              } else {
                game_self.game[gmv[1]][gmv[2]][gmv[3]] = gmv[4];
              }
            } else {
              game_self.game[gmv[1]][gmv[2]] = gmv[3];
            }
          } else {
            if (gmv[2]) {
              game_self.game[gmv[1]] = gmv[2];
            }
          }
        }
        game_self.game.queue.splice(game_self.game.queue.length - 1, 1);
      }
      return 1;
    });

    this.commands.push((game_self, gmv) => {
      if (gmv[0] === "NOTIFY" || gmv[0] === "notify") {
        game_self.updateLog(gmv[1]);
        game_self.game.queue.splice(game_self.game.queue.length - 1, 1);
      }
      return 1;
    });

    this.commands.push((game_self, gmv) => {
      if (gmv[0] === "STATUS" || gmv[0] === "status") {
	if (!gmv[2]) { gmv[2] = "all"; }
  	let players_to_go = [];

        if (gmv[2] === "all") {
          for (let i = 0; i < game_self.game.players.length; i++) {
            players_to_go.push(i + 1);
          }
	} else {
          try {
            if (gmv[2].isArray()) {
              players_to_go = gmv[2];
            } else {
              players_to_go = [gmv[2]];
            }
          } catch (err) {
            players_to_go = gmv[1];
          }
        }
	for (let i = 0; i < players_to_go.length; i++) {
          if (game_self.game.player == (i+1)) {
	    game_self.updateStatus(gmv[1]);
          }
        }
        game_self.game.queue.splice(game_self.game.queue.length - 1, 1);
      }
      return 1;
    });

    this.commands.push((game_self, gmv) => {
      if (gmv[0] === "LOAD") {
        //console.log("LOAD not supported in game engine - see saveload module");
      }
      return 1;
    });

    this.commands.push((game_self, gmv) => {
      if (gmv[0] === "SAVE") {
        game_self.game.queue.splice(game_self.game.queue.length - 1, 1);

        if (!game_self.app.options.saves) {
          game_self.app.options.saves = {};
        }

        //
        // we don't save from the LIVE version as we may have executed commands
        //
        // we save from the SAVED version in the options file
        //
        let game_id = game_self.game.id;
        let backup_game = JSON.parse(JSON.stringify(game_self.game));

        for (let i = 0; i < this.app.options.games.length; i++) {
          if (this.app.options.games[i].id === game_id) {
            backup_game = this.app.options.games[i];
            i = this.app.options.games.length + 1;
          }
        }

        backup_game.queue.push(
          `ACKNOWLEDGE\tre you sure you want to continue? Your game will continue the next time you click to continue, but if not all players have reloaded the game will break.`
        );
        backup_game.queue.push(
          `ACKNOWLEDGE\tGame Reloaded. Please confirm all players have reloaded before clicking to continue.`
        );

        game_self.app.options.saves[game_self.game.id] = backup_game;

        let loadurl = this.app.browser.protocol + "://" + this.app.browser.host;
        game_self.updateLog(
          `<p></p>This game has been saved. To restore from this point, all players should visit the following URL:<p></p>&nbsp;<p></p>${loadurl}/load?game_id=${game_self.game.id}<p></p>&nbsp;<p></p>`
        );

        //
        // is it safe to save here?
        //
        game_self.app.storage.saveOptions();
      }
      return 1;
    });

    this.commands.push((game_self, gmv) => {
      if (gmv[0] === "ACKNOWLEDGE") {
        let notice = gmv[1];
        let player = gmv[2]; // optional = which player must acknowledge to continue, or array of players

        game_self.saveGame(game_self.game.id);

        if (game_self.game.player == 0) {
          game_self.game.queue.splice(game_self.game.queue.length - 1, 1);
          game_self.updateStatusAndListCards(notice);
          return 1;
        }

        if (player) {
	  if (parseInt(player) > 0) {
	    if (this.game.player != parseInt(player)) {
              game_self.game.queue.splice(game_self.game.queue.length - 1, 1);
	      return 1;
	    }
	  }
	}

        game_self.game.halted = 1;
        let my_specific_game_id = game_self.game.id;

        game_self.playerAcknowledgeNotice(notice, function () {
          if (game_self.game.id != my_specific_game_id) {
            game_self.game = game_self.loadGame(my_specific_game_id);
          }
          game_self.acknowledge_overlay.hide();
          game_self.updateStatus("acknowledged...");
          game_self.game.queue.splice(game_self.game.queue.length - 1, 1);
          game_self.restartQueue();

          return 1;
        });

        return 0;
      }

      return 1;
    });

    this.commands.push((game_self, gmv) => {
      if (gmv[0] === "GAMEOVER") {
        if (game_self.browser_active == 1) {
          game_self.updateLog("Player has Quit the Game");
        }
        return 0;
      }
      return 1;
    });

    this.commands.push((game_self, gmv) => {
      if (gmv[0] === "ROUNDOVER") {
        game_self.game.queue.splice(game_self.game.queue.length - 1, 1);
        let winner = JSON.parse(gmv[1]);
        let reason = gmv[2];
        let losers = gmv[3] ? JSON.parse(gmv[3]) : null;
        let players = [];
        if (losers) {
          for (let p of winner.concat(losers)) {
            if (!players.includes(p)) {
              players.push(p);
            }
          }
        } else {
          players = game_self.game.players;
        }

        console.info("ROUNDOVER : " + players);
        console.info(JSON.parse(JSON.stringify(game_self.game.options)));
        if (game_self.game.players[0] == game_self.app.wallet.returnPublicKey()) {
          let newtx = game_self.app.wallet.createUnsignedTransactionWithDefaultFee();
          newtx.transaction.to.push(
            new saito.default.slip(game_self.app.wallet.returnPublicKey(), 0.0)
          );
          /* This is exactly like gameover so League can process */ 
          newtx.msg = {
            request: "roundover",
            game_id: game_self.game.id,
            winner,
            players: players.join("_"),
            module: game_self.game.module,
            reason: reason,
            ts: new Date().getTime(),
          };

          if (game_self.game.options?.league_id) {
            newtx.msg.league_id = game_self.game?.options?.league_id;
          }
          console.info(newtx.msg);

          newtx = game_self.app.wallet.signTransaction(newtx);

          //Send message
          game_self.app.network.propagateTransaction(newtx);
        }
        return 1;
      }
      return 1;
    });

    this.commands.push((game_self, gmv) => {
      if (gmv[0] === "OBSERVER") {
        let msgobj = {
          game_id: game_self.game.id,
          player: game_self.app.wallet.returnPublicKey(),
          module: game_self.game.module,
        };
        let msg = game_self.app.crypto.stringToBase64(JSON.stringify(msgobj));
        try {
          //
          // OBSOLETE MSG -- keeping code so reference for improvements here though
          //
          //  game_self.displayModal("Observer Mode now Active");
          //  game_self.updateLog(`Player ${game_self.game.player} has enabled observer mode. This can leak data on your private hand to your opponent.`);
        } catch (err) { }
        game_self.game.queue.splice(game_self.game.queue.length - 1, 1);
      }
      return 1;
    });

    this.commands.push((game_self, gmv) => {
      if (gmv[0] === "PLAY") {
        let players_to_go = [];
        if (gmv[1] === "all") {
          for (let i = 0; i < game_self.game.players.length; i++) {
            players_to_go.push(i + 1);
          }
        } else {
          try {
            if (gmv[1].isArray()) {
              players_to_go = gmv[1];
            } else {
              players_to_go = [gmv[1]];
            }
          } catch (err) {
            players_to_go = gmv[1];
          }
        }

        //
        // reset confs if we do not have confirms_needed
        //
        let reset_confirmations = 1;
        for (let i = 0; i < game_self.game.confirms_needed.length; i++) {
          if (game_self.game.confirms_needed[i] == 1) {
            reset_confirmations = 0;
          }
        }
        if (reset_confirmations == 1) {
          game_self.resetConfirmsNeeded(players_to_go);
        }

        let can_i_go = 0;
        for (let i = 0; i < players_to_go.length; i++) {
          if (game_self.game.player == parseInt(players_to_go[i])) {
            can_i_go = 1;
            if (game_self.game.confirms_needed[players_to_go[i] - 1] == 1) {
              game_self.playerTurn();
            }
          }
        }
        if (can_i_go == 0) {
          game_self.nonPlayerTurn();
        }

        return 0;
      }
      return 1;
    });

    this.commands.push((game_self, gmv) => {
      if (gmv[0] === "RESETCONFIRMSNEEDED") {
        let players_to_go = [];
        if (gmv[1] === "all") {
          for (let i = 0; i < game_self.game.players.length; i++) {
            players_to_go.push(i + 1);
          }
        } else {
          try {
            if (gmv[1].isArray()) {
              players_to_go = gmv[1];
            } else {
              players_to_go = [gmv[1]];
            }
          } catch (err) {
            players_to_go = gmv[1];
          }
        }

        //
        // reset confs if we do not have confirms_needed
        //
        let reset_confirmations = 1;
        for (let i = 0; i < game_self.game.confirms_needed.length; i++) {
          if (game_self.game.confirms_needed[i] == 1) {
            reset_confirmations = 0;
          }
        }
        if (reset_confirmations == 1) {
          game_self.resetConfirmsNeeded(players_to_go);
        }

        //
        // remove this instruction
        //
        game_self.game.queue.splice(game_self.game.queue.length - 1, 1);
        return 1;
      }
      return 1;
    });

    //
    // [RESOLVE]
    // or
    // [RESOLVE \t publickey] (multi-player simulatenous)
    //
    this.commands.push((game_self, gmv) => {
      if (gmv[0] === "RESOLVE") {
        //
        // resolve coming from specific player
        //
        if (gmv[1]) {
          for (let i = 0; i < game_self.game.players.length; i++) {
            if (game_self.game.players[i] === gmv[1]) {
              game_self.game.confirms_needed[i] = 0;
            }
          }
        } else {
          // no userkey provided, so this could be a DEAL or
          // some other command that is being executed WHILE
          // a lower-level command is waiting for all players
          // to move...
          if (game_self.game.queue.length - 1 == 0) {
            game_self.game.queue = [];
            return 1;
          } else {
            let gle = game_self.game.queue.length - 2;
            if (game_self.game.queue[gle] === "RESOLVE") {
              game_self.game.queue.splice(game_self.game.queue.length - 1, 1);
              return 1;
            } else {
              if (gle <= 0) {
                game_self.game.queue = [];
                return 1;
              } else {
                game_self.game.queue.splice(gle, 2);
                return 1;
              }
            }
          }
        }

        //
        // resolve previous command if we are not waiting for anyone
        //
        let resolve_queue = 1;
        for (let i = 0; i < game_self.game.confirms_needed.length; i++) {
          if (game_self.game.confirms_needed[i] == 1) {
            resolve_queue = 0;
          }
        }

        console.info("ready to resolve queue: " + resolve_queue);
        console.info(JSON.stringify(game_self.game.confirms_needed));

        let msg = "Players still to move:";
        let notice = "<ul>";
        let am_i_still_to_move = 0;
        let anyone_left_to_move = 0;
        for (let i = 0; i < game_self.game.confirms_needed.length; i++) {
          if (game_self.game.confirms_needed[i] == 1) {
            notice += '<li class="option resolve">' + game_self.returnPlayerName(i + 1) + "</li>";
            anyone_left_to_move = 1;
          }
          if (game_self.game.player == i + 1) {
            am_i_still_to_move = game_self.game.confirms_needed[i];
          }
        }
        notice += "</ul>";
        if (am_i_still_to_move == 0) {
          console.info("is anyone left to move: " + anyone_left_to_move);
          game_self.updateStatusWithOptions(msg, notice);
        }

        //
        // return 1 if we remove stuff
        //
        if (resolve_queue == 1) {
          if (game_self.game.queue.length - 1 == 0) {
            game_self.game.queue = [];
            return 1;
          } else {
            let gle = game_self.game.queue.length - 2;
            if (game_self.game.queue[gle] === "RESOLVE") {
              game_self.game.queue.splice(game_self.game.queue.length - 1, 1);
              return 1;
            } else {
              if (gle <= 0) {
                game_self.game.queue = [];
                return 1;
              } else {
                game_self.game.queue.splice(gle, 2);
                return 1;
              }
            }
          }
        }

        //
        // queue not resolves
        //
        game_self.game.queue.splice(game_self.game.queue.length - 1, 1);
        return 1;
      }

      return 1;
    });

    //
    // [PRERESOLVE \t cmd]
    //
    // inserts cmd in queue for execution after resolve clears
    //
    this.commands.push((game_self, gmv) => {
      if (gmv[0] === "PRERESOLVE") {
        //
        // resolve coming from specific player
        //
        if (gmv[1]) {
          for (let i = game_self.game.queue.length - 1; i >= 0; i--) {
            let lmv = game_self.game.queue[i].split("\t");
            if (lmv[0] === "RESOLVE") {
              game_self.game.queue.splice(i - 1, 0, gmv[1]);
              break;
            }
          }
        }
        return 1;
      }
      return 1;
    });

    /*
    READY is the signal that the game is ready to play, i.e. all the shuffling and stuff is done and
    players can move from the Arcade to the game page. Therefore, we want it to emit a 0 and stop queue
    execution so that players don't get out of sync by clicking "start game" while stuff is still happening.
    However, there are situations where we are in the game and run into a READY (observer, for one),
    so we don't want to stop queue execution in that case.
    */
    this.commands.push((game_self, gmv) => {
      if (gmv[0] == "READY") {
        game_self.game.initializing = 0;
        game_self.game.queue.splice(game_self.game.queue.length - 1, 1);
console.log("READ SAVE WITH GAMEID: " + game_self.game.id);
        game_self.saveGame(game_self.game.id);
        //Just cut, save, and move on if in the game page
        if (game_self.browser_active) {
          return 1;
        } else {
          //Otherwise we want to pause game processing
          game_self.initialize_game_run = 0; //Prevent processing of any incoming moves (until we navigate to the game page)
          console.info("GAME READY, emit signal");
          game_self.app.connection.emit("arcade-game-ready-render-request", { name: game_self.name, slug: game_self.returnSlug(), id: game_self.game.id });

          return 0;
        }
      }
      return 1;
    });

    this.commands.push((game_self, gmv) => {
      if (gmv[0] === "SHUFFLE") {
        game_self.shuffleDeck(parseInt(gmv[1]));
        game_self.game.queue.splice(game_self.game.queue.length - 1, 1);
      }
      return 1;
    });

    this.commands.push((game_self, gmv) => {
      if (gmv[0] === "SHUFFLEDISCARDS") {
        let deckidx = parseInt(gmv[1]);

        game_self.game.queue.splice(game_self.game.queue.length - 1, 1);
        let discarded_cards = {};

        for (let i in game_self.game.deck[deckidx - 1].discards) {
          discarded_cards[i] = game_self.game.deck[deckidx - 1].cards[i];
          delete game_self.game.deck[deckidx - 1].cards[i];
        }
        game_self.game.deck[deckidx - 1].discards = {};

        game_self.game.queue.push("SHUFFLE\t" + deckidx);
        game_self.game.queue.push("DECKRESTORE\t" + deckidx);
        for (let z = game_self.game.players.length; z >= 1; z--) {
          game_self.game.queue.push("DECKENCRYPT\t" + deckidx + "\t" + z);
        }
        for (let z = game_self.game.players.length; z >= 1; z--) {
          game_self.game.queue.push("DECKXOR\t" + deckidx + "\t" + z);
        }
        game_self.game.queue.push("DECK\t" + deckidx + "\t" + JSON.stringify(discarded_cards));
        game_self.game.queue.push("DECKBACKUP\t" + deckidx);
      }
      return 1;
    });

    this.commands.push((game_self, gmv) => {
      if (gmv[0] === "LOGDECK") {
        let deckidx = parseInt(gmv[1]);
        game_self.updateLog(
          `Contents of Deck: ${JSON.stringify(game_self.game.deck[deckidx - 1].crypt)}`
        );
        game_self.game.queue.splice(game_self.game.queue.length - 1, 1);
      }
      return 1;
    });

    this.commands.push((game_self, gmv) => {
      if (gmv[0] === "LOGHAND") {
        let deckidx = parseInt(gmv[1]);
        game_self.updateLog(`Contents of Hand: ${game_self.game.deck[deckidx - 1].hand}`);
        game_self.game.queue.splice(game_self.game.queue.length - 1, 1);
      }
      return 1;
    });

    this.commands.push((game_self, gmv) => {
      if (gmv[0] === "LOGPOOL") {
        let poolidx = parseInt(gmv[1]);
        game_self.updateLog(`Contents of Pool: ${game_self.game.pool[poolidx - 1].hand}`);
        game_self.game.queue.splice(game_self.game.queue.length - 1, 1);
      }
      return 1;
    });

    this.commands.push((game_self, gmv) => {
      if (gmv[0] === "RESOLVEDEAL") {
        let deckidx = parseInt(gmv[1]);
        let recipient = parseInt(gmv[2]);
        let cards = parseInt(gmv[3]);

        if (game_self.game.player == recipient) {
          // card must exist
          if (game_self.game.deck[deckidx - 1].crypt.length >= cards) {
            for (let i = 0; i < cards; i++) {
              let newcard = game_self.game.deck[deckidx - 1].crypt[i];
              //
              // if we have a key, this is encrypted
              //
              if (game_self.game.deck[deckidx - 1].keys[i] != undefined) {
                newcard = game_self.app.crypto.decodeXOR(
                  newcard,
                  game_self.game.deck[deckidx - 1].keys[i]
                );
              }

              newcard = game_self.app.crypto.hexToString(newcard);

              //NOTE: Each card in the deck must be unique
              if (!game_self.game.deck[deckidx - 1].hand.includes(newcard)) {
                game_self.game.deck[deckidx - 1].hand.push(newcard);
              }

              //Sanity check
              if (!game_self.game.deck[deckidx - 1].cards[newcard]) {
                console.warn("Card decryption error!");
                console.warn("Card: " + newcard, "deck:", JSON.parse(JSON.stringify(game_self.game.deck[deckidx - 1])));
              }
            }
          }
        }

        if (game_self.game.queue.length < 2) {
          game_self.game.queue = [];
        } else {
          game_self.game.queue.splice(game_self.game.queue.length - 2, 2);
        }

        //
        // everyone purges their spent keys
        //
        if (game_self.game.issued_keys_deleted == 0) {
          // observer mode -- has crypt, but not keys
          if (game_self.game.player == 0) {
            game_self.game.deck[deckidx - 1].crypt.splice(0, cards);
            game_self.game.issued_keys_deleted = 1;
            return 1;
          }

          if (game_self.game.deck[deckidx - 1].keys.length <= cards) {
            game_self.game.deck[deckidx - 1].keys = [];
            game_self.game.deck[deckidx - 1].crypt = [];
          } else {
            //Isn't this backwards????
            //game_self.game.deck[deckidx - 1].keys = game_self.game.deck[deckidx - 1].keys.splice(cards,game_self.game.deck[deckidx - 1].keys.length - cards);
            //game_self.game.deck[deckidx - 1].crypt = game_self.game.deck[deckidx - 1].crypt.splice(cards,game_self.game.deck[deckidx - 1].crypt.length - cards);
            game_self.game.deck[deckidx - 1].keys.splice(0, cards);
            game_self.game.deck[deckidx - 1].crypt.splice(0, cards);
            if (game_self.game.deck[deckidx - 1].keys.length !== game_self.game.deck[deckidx - 1].crypt.length) {
              console.warn("Key-Crypt mismatch:", JSON.parse(JSON.stringify(game_self.game.deck[deckidx - 1])));
            }
          }
          game_self.game.issued_keys_deleted = 1;
        }
      }
      return 1;
    });

    this.commands.push((game_self, gmv) => {
      if (gmv[0] === "SIMPLEDEAL") {
        game_self.game.queue.splice(game_self.game.queue.length - 1, 1);

        let players = game_self.game.players.length;
        let cards = parseInt(gmv[1]);
        let deckidx = parseInt(gmv[2]);
        let deck = JSON.parse(gmv[3]);

        for (let i = players; i >= 1; i--) {
          game_self.game.queue.push("DEAL\t" + deckidx + "\t" + i + "\t" + cards);
        }
        for (let i = players; i >= 1; i--) {
          game_self.game.queue.push("DECKENCRYPT\t" + deckidx + "\t" + i);
        }
        for (let i = players; i >= 1; i--) {
          game_self.game.queue.push("DECKXOR\t" + deckidx + "\t" + i);
        }
        game_self.game.queue.push("DECK\t" + deckidx + "\t" + JSON.stringify(deck));
      }
      return 1;
    });

    this.commands.push((game_self, gmv) => {
      if (gmv[0] === "DEAL") {
        let deckidx = parseInt(gmv[1]);
        let recipient = parseInt(gmv[2]);
        let cards = parseInt(gmv[3]);

        console.info(`Dealing ${cards} cards to ${recipient}. Deck has ${game_self.game.deck[deckidx - 1].crypt.length} cards`);

        //
        // resolvedeal checks this when
        // deleting the keys from its
        // crypt.
        //
        game_self.game.issued_keys_deleted = 0;

        let total_players = game_self.game.players.length;

        //
        // do not permit dealing more keys than exist in this deck
        //
        if (this.game.player > 0) {
          if (game_self.game.deck[deckidx - 1].keys.length < cards) {
            cards = game_self.game.deck[deckidx - 1].keys.length;
          }
        }

        // if the total players is 1 -- solo game
        if (total_players == 1) {
          game_self.game.queue.push("RESOLVEDEAL\t" + deckidx + "\t" + recipient + "\t" + cards);
        } else {
          game_self.game.queue.push("RESOLVEDEAL\t" + deckidx + "\t" + recipient + "\t" + cards);
          for (let i = 1; i <= total_players; i++) {
            if (i != recipient) {
              //The recipient decodes last (without broadcasting their keys so other players cannot snoop)
              game_self.game.queue.push(
                "REQUESTKEYS\t" + deckidx + "\t" + i + "\t" + recipient + "\t" + cards
              );
            }
          }
        }
      }
      return 1;
    });

    //
    // SAFEDEAL shuffles discards back into the deck before dealing
    // if necessary and discards are available. if there are no more
    // cards to be dealt, it ends the game.
    //
    this.commands.push((game_self, gmv) => {
      if (gmv[0] === "SAFEDEAL") {
        game_self.game.queue.splice(game_self.game.queue.length - 1, 1);

        let deckidx = parseInt(gmv[1]);
        let recipient = parseInt(gmv[2]);
        let cards_to_deal = parseInt(gmv[3]);

        //
        // check we have enough cards in this deck
        //

        if (game_self.game.deck[deckidx - 1].crypt.length >= cards_to_deal) {
          this.game.queue.push("DEAL\t" + deckidx + "\t" + recipient + "\t" + cards_to_deal);
        } else {
          let cards_to_deal_first = game_self.game.deck[deckidx - 1].crypt.length;
          let cards_to_deal_after = cards_to_deal - cards_to_deal_first;

          let discarded_cards = {};

          for (let i in game_self.game.deck[deckidx - 1].discards) {
            discarded_cards[i] = game_self.game.deck[deckidx - 1].cards[i];
            delete game_self.game.deck[deckidx - 1].cards[i];
          }
          game_self.game.deck[deckidx - 1].discards = {};

          if (Object.keys(discarded_cards).length <= 0) {
            game_self.updateLog(
              "skipping deal - no cards available and no discards for reshuffling"
            );
          } else {
            game_self.game.queue.push(
              "DEAL\t" + deckidx + "\t" + recipient + "\t" + cards_to_deal_after
            );
            //
            // shuffle in discarded cards
            //
            game_self.game.queue.push("SHUFFLE\t" + deckidx);
            game_self.game.queue.push("DECKRESTORE\t" + deckidx);
            for (let z = game_self.game.players.length; z >= 1; z--) {
              game_self.game.queue.push("DECKENCRYPT\t" + deckidx + "\t" + z);
            }
            for (let z = game_self.game.players.length; z >= 1; z--) {
              game_self.game.queue.push("DECKXOR\t" + deckidx + "\t" + z);
            }
            // DECKFLUSH not needed as we are all executing this
            game_self.game.queue.push("DECK\t" + deckidx + "\t" + JSON.stringify(discarded_cards));
            game_self.game.queue.push("DECKBACKUP\t" + deckidx);

            if (cards_to_deal_first > 0) {
              game_self.game.queue.push(
                "DEAL\t" + deckidx + "\t" + recipient + "\t" + cards_to_deal_first
              );
            }
          }
        }
      }
      return 1;
    });

    this.commands.push((game_self, gmv) => {
      if (gmv[0] === "PUSHONDECK") {
        game_self.game.queue.splice(game_self.game.queue.length - 1, 1);

        let deckidx = parseInt(gmv[1]);
        //game_self.game.queue.push("LOGDECK\t"+deckidx);
        game_self.game.queue.push(`DECKRESTORE\t${deckidx}\tpush`);
        for (let z = game_self.game.players.length; z >= 1; z--) {
          game_self.game.queue.push("DECKENCRYPT\t" + deckidx + "\t" + z);
        }
        for (let z = game_self.game.players.length; z >= 1; z--) {
          game_self.game.queue.push("DECKXOR\t" + deckidx + "\t" + z);
        }
        game_self.game.queue.push("DECK\t" + deckidx + "\t" + gmv[2]);
        game_self.game.queue.push("DECKBACKUP\t" + deckidx);
        //game_self.game.queue.push("LOGDECK\t"+deckidx);
      }
      return 1;
    });

    this.commands.push((game_self, gmv) => {
      if (gmv[0] === "REQUESTKEYS") {
        let deckidx = parseInt(gmv[1]);
        let sender = parseInt(gmv[2]);
        let recipient = parseInt(gmv[3]);
        let cards = parseInt(gmv[4]); //number of cards to deal

        //Only the player who is the sender should process
        if (game_self.game.player !== sender) {
          return 0;
        }

        //
        // I sends keys
        //
        game_self.game.turn = [];
        game_self.game.turn.push("RESOLVE");
        for (let i = 0; i < cards; i++) {
          game_self.game.turn.push(game_self.game.deck[deckidx - 1].keys[i]);
        }
        game_self.game.turn.push(
          `ISSUEKEYS\t${deckidx}\t${sender}\t${recipient}\t${cards}\t${game_self.game.deck[deckidx - 1].keys.length
          }`
        );
        game_self.sendMessage("game", {});

        return 0;
      }
      return 1;
    });

    this.commands.push((game_self, gmv) => {
      if (gmv[0] === "ISSUEKEYS") {
        let deckidx = parseInt(gmv[1]);
        let sender = parseInt(gmv[2]);
        let recipient = parseInt(gmv[3]);
        let cards = parseInt(gmv[4]);
        let opponent_deck_length = parseInt(gmv[5]); // this is telling us how many keys the other player has, so we can coordinate and now double-decrypt

        game_self.game.queue.splice(game_self.game.queue.length - 1, 1); //Remove "ISSUEKEYS"

        let keyidx = game_self.game.queue.length - cards;

        let my_deck_length = game_self.game.deck[deckidx - 1].crypt.length;

        if (game_self.game.player == recipient) {
          if (my_deck_length == opponent_deck_length) {
            for (let i = 0; i < cards; i++) {
              if (game_self.game.queue[keyidx + i] != null) {
                game_self.game.deck[deckidx - 1].crypt[i] = game_self.app.crypto.decodeXOR(
                  game_self.game.deck[deckidx - 1].crypt[i],
                  game_self.game.queue[keyidx + i]
                );
              }
            }
          } else {
            console.warn("ISSUEKEYS issue: deck lengths mismatch");
          }
        }

        //
        // this avoids splicing out valuable instructions if no cards left
        //
        if (cards > 0) {
          game_self.game.queue.splice(keyidx, cards);
        }
      }
      return 1;
    });

    //
    // SECUREROLL player [hash] [sig_affirming_hash]
    //
    // designed to be stateless, so that if initiating player forgets their commit hash, we fallback
    // to the other players.
    //
    this.commands.push((game_self, gmv) => {
      if (gmv[0] === "SECUREROLL") {
        let player = parseInt(gmv[1]);
        let hash = gmv[2];
        let sig = gmv[3];

        let players = [];
        let hashes = [];

        let move = "";

        for (let i = game_self.game.queue.length - 1; i >= 0; i--) {
          let sr = game_self.game.queue[i].split("\t");
          if (sr[0] === "SECUREROLL") {
            // validate player signed (not a fake submission)
            if (
              game_self.app.crypto.verifyMessage(sr[2], sr[3], game_self.game.players[sr[1] - 1]) ==
              true
            ) {
              players.push(sr[1]);
              hashes.push(sr[2]);
            } else {
              console.warn(
                "SIG DOES NOT VERIFY " +
                sr[2] +
                " / " +
                sr[3] +
                " / " +
                game_self.game.players[sr[1] - 1]
              );
              return 0;
            }
          } else {
            if (sr[0] === "SECUREROLL_END") {
              break;
            } else {
              // normal move requiring hash
              move += game_self.game.queue[i];
            }
          }
        }

        //
        // at this point we have the game move to be executed in a single string so it can
        // be hashed and used as an input. any changes to the moves broadcast would result
        // in a different hash.
        //

        //
        // our players and hashes array contains the hashes of all players who have already
        // broadcast them AND -- if we are ready to continue -- two hashes from the initiating
        // player which validate each other and demonstrate the initiating player has not
        // attempted to game the random-number selection mechanism.
        //
        // players <--- numbers
        // hashes <--- submitted hashes
        //
        // game.sroll <--- 1 when requesting secureroll
        // game.sroll_hash <--- prehash that needs remembering for initiating player
        // game.sroll_done <--- have I broadcast my contribution to randgen?
        //

        //
        // the last player in the array will be the one who started the SECUREROLL request
        // as theirs (the first) will be the last hash added to our array. so we can use
        // this technique to identify the originating player in a stateless fashion.
        //
        let initiating_player = players[players.length - 1];
        let initiating_hash = hashes[hashes.length - 1];

        //
        //
        //
        let do_we_have_all_players = 1;
        let has_initiating_player_committed_two_hashes = 0;
        let does_second_hash_hash_to_first = 0;

        for (let y = 1; y <= game_self.game.players.length; y++) {
          let player_found = 0;
          for (let z = 0; z < players.length; z++) {
            if (players[z] == y) {
              player_found = 1;
            }
          }
          if (player_found == 0) {
            do_we_have_all_players = 0;
            break;
          }
        }

        //
        //
        //
        if (game_self.game.sroll_done == 0) {
          if (game_self.game.player != initiating_player) {
            //
            // contribute my own random number
            //
            let hash1 = game_self.app.crypto.hash(Math.random());
            let hash1_sig = game_self.app.crypto.signMessage(
              hash1,
              game_self.app.wallet.returnPrivateKey()
            );
            game_self.addMove(
              "SECUREROLL\t" + game_self.game.player + "\t" + hash1 + "\t" + hash1_sig
            );
            game_self.game.sroll_done = 1;
            game_self.endTurn();
            return 0;
          }
        }

        //
        // if we do not have all players, just wait until we do
        //
        if (do_we_have_all_players == 0) {
          return 0;
        }

        //
        // now we have all players, so find out
        //
        // has originating player send double commit
        //
        let originating_player = players[players.length - 1];
        let originating_hash = hashes[players.length - 1];
        let their_second_hash = "";
        for (let z = 0; z < players.length - 1; z++) {
          if (players[z] == originating_player) {
            their_second_hash = hashes[z];
          }
        }

        //
        //
        //
        if (their_second_hash === "") {
          // if I am the originating player, I send the second hash now
          if (game_self.game.player == originating_player) {
            let hash_sig = game_self.app.crypto.signMessage(
              game_self.game.sroll_hash,
              game_self.app.wallet.returnPrivateKey()
            );
            game_self.addMove(
              "SECUREROLL\t" +
              game_self.game.player +
              "\t" +
              game_self.game.sroll_hash +
              "\t" +
              hash_sig
            );
            game_self.game.sroll_done = 1;
            game_self.endTurn();
            return 0;
          }
          return 0;
        } else {
          if (game_self.app.crypto.hash(their_second_hash) === originating_hash) {
            let new_random = game_self.app.crypto.hash(move);
            for (let z = 0; z < hashes.length; z++) {
              new_random = game_self.app.crypto.hash(new_random + hashes[z]);
            }

            game_self.game.dice = new_random;

            //
            // we have updated the dice to a new random, so we can
            // remove the SECUREROLL components. One this is done we
            // can return 1 to continue the move!
            //
            for (let i = game_self.game.queue.length - 1; i >= 0; i--) {
              let sr = game_self.game.queue[i].split("\t");
              if (sr[0] === "SECUREROLL") {
                game_self.game.queue.splice(game_self.game.queue.length - 1, 1);
              } else {
                break;
              }
            }

            //
            // we should have cleared the move
            //
            return 1;
          } else {
            alert(
              "ERROR: the player which triggered the secure-dice-roll did not submit a second hash which hashed to their original commit. This invalidates the security of the random number generation. Halting."
            );
          }
          return 0;
        }
        //
        // we do not clear the queue by default
        //
        return 0;
      }
      return 1;
    });
    //
    // remove for natural fallthrough
    //
    this.commands.push((game_self, gmv) => {
      if (gmv[0] === "SECUREROLL_END") {
        // reset for next time
        game_self.game.sroll = 0;
        game_self.game.sroll_hash = "";
        game_self.game.sroll_done = 0;
        game_self.game.queue.splice(game_self.game.queue.length - 1, 1);
      }
      return 1;
    });

    //
    // SIMULTANEOUS_PICK player [hash] [sig_affirming_hash]
    //
    // designed to be stateless, so that all information needed to decode the cards
    // ends up on the game queue.
    //
    this.commands.push((game_self, gmv) => {
      if (gmv[0] === "SIMULTANEOUS_PICK") {
        let player = parseInt(gmv[1]);
        let hash = gmv[2];
        let sig = gmv[3];

        let players = [];
        let hashes = [];
        let move = "";

        for (let i = game_self.game.queue.length - 1; i >= 0; i--) {
          let sr = game_self.game.queue[i].split("\t");
          if (sr[0] === "SIMULTANEOUS_PICK") {
            // validate player signed (not a fake submission)
            if (
              game_self.app.crypto.verifyMessage(sr[2], sr[3], game_self.game.players[sr[1] - 1]) ==
              true
            ) {
              players.push(sr[1]);
              hashes.push(sr[2]);
            } else {
              console.warn(`SIG DOES NOT VERIFY  ${sr[2]} / ${sr[3]} / ${game_self.game.players[sr[1] - 1]}`);
              return 0;
            }
          } else {
            if (sr[0] === "SIMULTANEOUS_PICK_END") {
              break;
            }
          }
        }

        //
        // the hashes and players array is filled with any submitted moves. we want to wait
        // until all (other) players have submitted their initial commits before we submit
        // our follow-up hash that will unlock our selection.
        //

        //
        // our players and hashes array contains the hashes of all players who have already
        // broadcast them AND -- if we are ready to continue -- two hashes from the initiating
        // player which validate each other and demonstrate the initiating player has not
        // attempted to game the random-number selection mechanism.
        //
        // players <--- numbers
        // hashes <--- submitted hashes
        //
        // game.spick_hash <--- prehash that needs remembering for initiating player
        // game.spick_done <--- have I broadcast my second hash yet?
        //

        //
        // the order of provision does not matter in simulatenous card picks, as all players
        // will / should only submit their unlocking hashes once the other players have
        // submitted at least one hash.
        //

        //
        //
        //
        let do_we_have_all_players = 1;
        let do_we_have_me = 0;

        for (let y = 1; y <= game_self.game.players.length; y++) {
          let player_found = 0;
          for (let z = 0; z < players.length; z++) {
            if (players[z] == y) {
              player_found = 1;
              if (z == game_self.game.player - 1) {
                //should be tested against y, no?
                do_we_have_me = 1;
              }
            }
          }
          if (player_found == 0) {
            do_we_have_all_players = 0;
            break;
          }
        }

        //
        // if we do not have all players, just wait until we do
        //
        if (do_we_have_all_players == 0) {
          return 0;
        }

        //
        // if we reach here, all players have submitted, so we send the second
        //
        if (game_self.game.spick_done == 0) {
          //
          // the order of submission gets the selection onto the queue last
          //
          let card_sig = game_self.app.crypto.signMessage(
            game_self.game.spick_card,
            game_self.app.wallet.returnPrivateKey()
          );
          let hash2 = game_self.game.spick_hash;
          let hash2_sig = game_self.app.crypto.signMessage(
            hash2,
            game_self.app.wallet.returnPrivateKey()
          );
          game_self.addMove(
            "SIMULTANEOUS_PICK\t" + game_self.game.player + "\t" + hash2 + "\t" + hash2_sig
          );
          game_self.addMove(
            `SIMULTANEOUS_PICK\t${game_self.game.player}\t${game_self.game.spick_card}\t${card_sig}`
          );
          game_self.game.spick_done = 1;
          game_self.endTurn();
          return 0;
        }

        //
        // have all players submitted all three sigs?
        //
        let have_all_players_submitted_three_sigs = 1;

        //
        // find out
        //
        for (let y = 1; y <= game_self.game.players.length; y++) {
          let commits_found = 0;
          for (let z = 0; z < players.length; z++) {
            if (players[z] == y) {
              commits_found++;
            }
          }
          if (commits_found < 3) {
            have_all_players_submitted_three_sigs = 0;
          }
        }

        //
        // keep waiting otherwise
        //
        if (have_all_players_submitted_three_sigs == 0) {
          return 0;
        }

        //
        // hashes will be on the blockchain in verse order
        //
        game_self.game.state.sp = [];
        for (let player_id = 1; player_id <= game_self.game.players.length; player_id++) {
          let player_card = "";
          let player_card_set = 0;
          let player_hash_idx = 0;
          let player_hash = "";

          for (let k = 0; k < players.length; k++) {
            if (players[k] == player_id) {
              player_hash_idx++;
              if (player_card_set == 0) {
                player_card = hashes[k];
                player_card_set = 1;
                player_hash = game_self.app.crypto.hash(player_card);
              } else {
                if (player_hash_idx == 2) {
                  player_hash = game_self.app.crypto.hash(hashes[k] + player_hash);
                } else {
                  //
                  // if hash is incorrect, player is dishonest
                  //
                  if (player_hash != hashes[k]) {
                    alert(
                      "ERROR: Player " +
                      player_id +
                      " has submitted inconsistent hash values for their card selection. Halting."
                    );
                    return 0;
                  } else {
                    game_self.game.state.sp[player_id - 1] = player_card;
                  }
                }
              }
            }
          }
        }

        console.info("SIMULTANEOUS_PICK finished..., pruning queue");
        //
        // we have updated so we can remove the SIMULTANEOUS_PICK instructions
        //
        for (let i = game_self.game.queue.length - 1; i >= 0; i--) {
          console.info(game_self.game.queue[i]);
          let sr = game_self.game.queue[i].split("\t");
          if (sr[0] === "SIMULTANEOUS_PICK") {
            game_self.game.queue.splice(game_self.game.queue.length - 1, 1);
          } else {
            break;
          }
        }
        console.info(JSON.parse(JSON.stringify(game_self.game.queue)));
        //
        // if we hit here, we should be ready to continue
        //
        return 1;
      }
      return 1;
    });

    //
    // module requires updating
    //
    // TODO -- update copy basic on dynamic contents, hasOwnProperty, etc. not manually
    // this allows for modules to dynamically add their own properties to the deck and
    // have those backed-up as well -- see fhand. Also DECKRESTORE should do reverse.
    //
    this.commands.push((game_self, gmv) => {
      if (gmv[0] === "DECKBACKUP") {
        let deckidx = parseInt(gmv[1]);

        while (game_self.game.deck.length < deckidx) {
          game_self.addDeck();
        }

        console.info(JSON.parse(JSON.stringify(game_self.game.deck[deckidx - 1])));
        game_self.old_discards = game_self.game.deck[deckidx - 1].discards;
        game_self.old_removed = game_self.game.deck[deckidx - 1].removed;
        game_self.old_cards = {};
        game_self.old_crypt = [];
        game_self.old_keys = [];
        game_self.old_hand = [];

        //What is fhand?
        if (game_self.game.deck[deckidx - 1].fhand) {
          game_self.old_fhand = game_self.game.deck[deckidx - 1].fhand;
        }

        for (let i = 0; i < game_self.game.deck[deckidx - 1].crypt.length; i++) {
          game_self.old_crypt[i] = game_self.game.deck[deckidx - 1].crypt[i];
          game_self.old_keys[i] = game_self.game.deck[deckidx - 1].keys[i];
        }
        for (var i in game_self.game.deck[deckidx - 1].cards) {
          game_self.old_cards[i] = game_self.game.deck[deckidx - 1].cards[i];
        }
        for (let i = 0; i < game_self.game.deck[deckidx - 1].hand.length; i++) {
          game_self.old_hand[i] = game_self.game.deck[deckidx - 1].hand[i];
        }

        game_self.game.queue.splice(game_self.game.queue.length - 1, 1);
      }
      return 1;
    });

    /*There are two ways to restore, which usually doesn't matter as the next
      instruction is almost always a shuffle, but we can restore the deck before/after
      the (added deck cards) add "push" to put new cards on top of deck,
      otherwise defaults to bottom of deck
    */
    this.commands.push((game_self, gmv) => {
      if (gmv[0] === "DECKRESTORE") {
        let deckidx = gmv[1];

        while (game_self.game.deck.length < deckidx) {
          game_self.addDeck();
        }

        if (gmv[2] == "push") {
          for (let i = 0; i < game_self.old_hand.length; i++) {
            game_self.game.deck[deckidx - 1].hand.push(game_self.old_hand[i]);
          }
          for (let i = 0; i < game_self.old_crypt.length; i++) {
            game_self.game.deck[deckidx - 1].crypt.push(game_self.old_crypt[i]);
            game_self.game.deck[deckidx - 1].keys.push(game_self.old_keys[i]);
          }
        } else {
          for (let i = game_self.old_hand.length - 1; i >= 0; i--) {
            game_self.game.deck[deckidx - 1].hand.unshift(game_self.old_hand[i]);
          }
          for (let i = game_self.old_crypt.length - 1; i >= 0; i--) {
            game_self.game.deck[deckidx - 1].crypt.unshift(game_self.old_crypt[i]);
            game_self.game.deck[deckidx - 1].keys.unshift(game_self.old_keys[i]);
          }
        }

        for (var b in game_self.old_cards) {
          game_self.game.deck[deckidx - 1].cards[b] = game_self.old_cards[b];
        }

        game_self.game.deck[deckidx - 1].removed = game_self.old_removed;
        game_self.game.deck[deckidx - 1].discards = game_self.old_discards;

        console.info(JSON.parse(JSON.stringify(game_self.game.deck[deckidx - 1])));

        game_self.old_removed = {};
        game_self.old_discards = {};

        game_self.old_cards = {};
        game_self.old_crypt = [];
        game_self.old_keys = [];
        game_self.old_hand = [];
        game_self.game.queue.splice(game_self.game.queue.length - 1, 1);
      }
    });

    /*
      Given index of deck and length of crypt array
      Reads gmv[2] cards from game.queue and inserts them into deck[].crypt
    */
    this.commands.push((game_self, gmv) => {
      if (gmv[0] === "CARDS") {
        //console.info("CARDS START: " + JSON.stringify(game_self.game.queue));
        let deckidx = parseInt(gmv[1]);
        let cryptLength = parseInt(gmv[2]);

        //console.info(deckidx + " --- " + gmv[2]);

        game_self.game.queue.splice(game_self.game.queue.length - 1, 1);

        for (let i = 1; i <= cryptLength; i++) {
          //Adding one to i here so don't have to insert additional -1 term
          let card = game_self.game.queue.pop();
          //if (game_self.game.player != 0) {
          game_self.game.deck[deckidx - 1].crypt[cryptLength - i] = card;

          //}
        }
        //console.info("CARDS END: " + JSON.stringify(game_self.game.queue));
      }
      return 1;
    });

    /*
      Creates the pool data structure
    */
    this.commands.push((game_self, gmv) => {
      if (gmv[0] === "POOL") {
        let poolidx = gmv[1];
        while (game_self.game.pool.length < poolidx) {
          game_self.addPool();
        }
        game_self.resetPool(poolidx - 1);

        game_self.game.queue.splice(game_self.game.queue.length - 1, 1);
      }
      return 1;
    });

    this.commands.push((game_self, gmv) => {
      if (gmv[0] === "SAFEPOOLDEAL") {
        game_self.game.queue.splice(game_self.game.queue.length - 1, 1);
        let deckidx = parseInt(gmv[1]);
        let cards_to_flip = parseInt(gmv[2]);
        let poolidx = parseInt(gmv[3]);

        game_self.game.issued_keys_deleted = 0;
        if (cards_to_flip <= game_self.game.deck[deckidx - 1].crypt.length) {
          game_self.game.queue.push(`POOLDEAL\t${gmv[1]}\t${gmv[2]}\t${gmv[3]}`);
        } else {
          let cards_in_deck = game_self.game.deck[deckidx - 1].crypt.length;
          game_self.game.queue.push(
            `POOLDEAL\t${gmv[1]}\t${cards_to_flip - cards_in_deck}\t${gmv[3]}`
          );
          game_self.game.queue.push(`SHUFFLEDISCARDS\t${deckidx}`);
          game_self.game.queue.push(`POOLDEAL\t${gmv[1]}\t${cards_in_deck}\t${gmv[3]}`);
        }
      }
      return 1;
    });
    /**
     * A command of convenience for the flop in poker
     */
    this.commands.push((game_self, gmv) => {
      if (gmv[0] === "POOLDEAL") {
        game_self.game.queue.splice(game_self.game.queue.length - 1, 1);
        let deckidx = parseInt(gmv[1]);
        let cards_to_flip = parseInt(gmv[2]);
        let poolidx = parseInt(gmv[3]);

        game_self.game.issued_keys_deleted = 0;

        for (let i = 1; i <= this.game.players.length; i++) {
          this.game.queue.push(`FLIPCARD\t${deckidx}\t${cards_to_flip}\t${poolidx}\t${i}`);
        }

        //Reset the pool
        this.game.queue.push("FLIPRESET\t" + poolidx);
      }
      return 1;
    });

    this.commands.push((game_self, gmv) => {
      if (gmv[0] === "FLIPRESET") {
        let poolidx = gmv[1];
        while (game_self.game.pool.length < poolidx) {
          game_self.addPool();
        }
        //Doesn't reset game_self.game.pool[poolidx-1].cards {} or .hand []
        game_self.game.pool[poolidx - 1].crypt = [];
        game_self.game.pool[poolidx - 1].keys = [];
        game_self.game.pool[poolidx - 1].decrypted = 0;
        game_self.game.queue.splice(game_self.game.queue.length - 1, 1);
      }
      return 1;
    });

    /*
    Deals cards from the deck to the pool (a common "hand" all players can see)
    */
    this.commands.push((game_self, gmv) => {
      if (gmv[0] === "FLIPCARD") {
        let deckidx = gmv[1];
        let cardnum = gmv[2];
        let poolidx = gmv[3];
        let playerid = parseInt(gmv[4]); //who is sending the keys

        //
        // players process 1 by 1
        //
        if (playerid != game_self.game.player) {
          return 0;
        }

        //
        // create pool if not exists
        //
        while (game_self.game.pool.length < poolidx) {
          game_self.addPool();
        }

        //
        // share card decryption information
        //
        game_self.game.turn = [];
        game_self.game.turn.push("RESOLVE");

        cardnum = Math.min(cardnum, game_self.game.deck[deckidx - 1].crypt.length);
        //Deals from bottom of deck ??
        for (let i = 0; i < cardnum; i++) {
          game_self.game.turn.push(game_self.game.deck[deckidx - 1].keys[i]);
        }
        game_self.game.turn.push(`RESOLVEFLIP\t${deckidx}\t${cardnum}\t${poolidx}`);

        game_self.sendMessage("game", {});

        return 0;
      }
      return 1;
    });

    /*
    Preceeds (cardnum) keys on the queue for decrypting cards to store into each players pool
    */
    this.commands.push((game_self, gmv) => {
      if (gmv[0] === "RESOLVEFLIP") {
        let deckidx = parseInt(gmv[1]);
        let cardnum = parseInt(gmv[2]);
        let poolidx = parseInt(gmv[3]);

        //
        // create pool if not exists, possible edge-case
        //
        while (game_self.game.pool.length < poolidx) {
          game_self.addPool();
        }

        //
        // how many players are going to send us decryption keys?
        //
        let decryption_keys_needed = game_self.game.players.length;

        //
        // if this is the first flip, we add the card to the crypt deck
        // so that we can decrypt them as the keys come in.
        //
        if (game_self.game.pool[poolidx - 1].crypt.length == 0) {
          //console.info("First pool resolution");
          //
          // update cards available to pool (master description of the deck)
          game_self.game.pool[poolidx - 1].cards = game_self.game.deck[deckidx - 1].cards;

          //
          // copy the card info over from the deck
          //
          for (let z = 0; z < cardnum; z++) {
            game_self.game.pool[poolidx - 1].crypt.push(game_self.game.deck[deckidx - 1].crypt[z]);
          }
          //for (let p = 0; p < decryption_keys_needed; p++) {
          //  game_self.game.pool[poolidx - 1].keys.push([]);
          //}
        }

        //
        // now we can get the keys
        //
        game_self.game.queue.splice(game_self.game.queue.length - 1, 1); //Remove "ISSUEKEYS"
        let keyidx = game_self.game.queue.length - cardnum;

        for (let i = 0; i < cardnum; i++) {
          let nc = game_self.game.pool[poolidx - 1].crypt[i];
          let thiskey = game_self.game.queue[keyidx + i];

          // add the key -- do we need to save it ?
          //game_self.game.pool[poolidx - 1].keys[i] = thiskey;

          if (thiskey != null) {
            nc = game_self.app.crypto.decodeXOR(nc, thiskey);
          } else {
            // nc does not require decoding
            console.info("Card doesn't need decoding");
          }

          // store card in pool
          game_self.game.pool[poolidx - 1].crypt[i] = nc;
        }
        // processed one set of keys
        game_self.game.pool[poolidx - 1].decrypted++;

        if (cardnum > 0) {
          game_self.game.queue.splice(keyidx, cardnum);
        }

        //
        // if everything is handled, purge old deck data
        //
        if (game_self.game.pool[poolidx - 1].decrypted == decryption_keys_needed) {
          for (let i = 0; i < cardnum; i++) {
            let newcard = game_self.game.pool[poolidx - 1].crypt[i];
            newcard = game_self.app.crypto.hexToString(newcard);
            if (!game_self.game.pool[poolidx - 1].hand.includes(newcard)) {
              game_self.game.pool[poolidx - 1].hand.push(newcard);
            }
            if (!game_self.game.pool[poolidx - 1].cards[newcard]) {
              console.warn("Card decryption error!");
              console.warn("Card: " + newcard, "pool:", JSON.parse(JSON.stringify(game_self.game.pool[poolidx - 1])));
            }
          }
          game_self.game.pool[poolidx - 1].crypt.splice(0, cardnum);
          game_self.game.deck[deckidx - 1].keys.splice(0, cardnum);
          game_self.game.deck[deckidx - 1].crypt.splice(0, cardnum);
        }
      }
      return 1;
    });

    //
    // OBSERVER_CHECKPOINT - observers stop execution
    //
    this.commands.push((game_self, gmv) => {
      if (gmv[0] === "OBSERVER_CHECKPOINT") {
        game_self.game.queue.splice(game_self.game.queue.length - 1, 1);
        if (game_self.game.player == 0) {
          game_self.game.halted = 1;
          game_self.saveGame(game_self.game.id);
          game_self.observerControls.updateStatus("Pause for Observer Checkpoint");
          return 0;
        }
        return 1;
      }
      return 1;
    });

    /*
     * A command of convience to create and process a deck
     */
    this.commands.push((game_self, gmv) => {
      if (gmv[0] === "DECKANDENCRYPT") {
        let deckidx = parseInt(gmv[1]);
        let players = parseInt(gmv[2]);
        //let cards = JSON.parse(gmv[3]);

        game_self.game.queue.splice(game_self.game.queue.length - 1, 1);

        for (let i = players; i > 0; i--) {
          this.game.queue.push("DECKENCRYPT\t" + deckidx + "\t" + i);
        }
        for (let i = players; i > 0; i--) {
          this.game.queue.push("DECKXOR\t" + deckidx + "\t" + i);
        }
        this.game.queue.push("DECK\t" + deckidx + "\t" + gmv[3]);
      }
      return 1;
    });

    /*
      Creates a deck + it's cryptographic version
    */
    this.commands.push((game_self, gmv) => {
      if (gmv[0] === "DECK") {
        let deckidx = parseInt(gmv[1]);
        let cards = JSON.parse(gmv[2]);
        //
        // create deck if not exists
        //
        while (game_self.game.deck.length < deckidx) {
          game_self.addDeck();
        }
        game_self.resetDeck(deckidx - 1);
        game_self.game.deck[deckidx - 1].cards = cards;

        for (var i in game_self.game.deck[deckidx - 1].cards) {
          game_self.game.deck[deckidx - 1].crypt.push(game_self.app.crypto.stringToHex(i));
        }

        console.log("DECK",JSON.parse(JSON.stringify(game_self.game.deck[deckidx - 1])));
        game_self.game.queue.splice(game_self.game.queue.length - 1, 1);
      }
      return 1;
    });

    this.commands.push((game_self, gmv) => {
      if (gmv[0] === "DECKXOR") {

        let deckidx = parseInt(gmv[1]);
        let playerid = parseInt(gmv[2]);

        if (playerid != game_self.game.player) {
          return 0;
        }
        if (game_self.game.deck[deckidx - 1].xor == "") {
          game_self.game.deck[deckidx - 1].xor = game_self.app.crypto.hash(Math.random());
        }

        for (let i = 0; i < game_self.game.deck[deckidx - 1].crypt.length; i++) {
          game_self.game.deck[deckidx - 1].crypt[i] = game_self.app.crypto.encodeXOR(
            game_self.game.deck[deckidx - 1].crypt[i],
            game_self.game.deck[deckidx - 1].xor
          );
          game_self.game.deck[deckidx - 1].keys[i] = game_self.app.crypto.generateKeys();
        }

        //
        // shuffle the encrypted deck
        //
        game_self.game.deck[deckidx - 1].crypt = game_self.shuffleArray(
          game_self.game.deck[deckidx - 1].crypt
        );

        game_self.game.turn = [];
        game_self.game.turn.push("RESOLVE");
        for (let i = 0; i < game_self.game.deck[deckidx - 1].crypt.length; i++) {
          game_self.game.turn.push(game_self.game.deck[deckidx - 1].crypt[i]);
        }
        game_self.game.turn.push(
          `CARDS\t${deckidx}\t${game_self.game.deck[deckidx - 1].crypt.length}`
        );

        let extra = {};

        game_self.sendMessage("game", extra);

        //
        // stop execution until messages received
        //
        return 0;
      }
      return 1;
    });

    //
    // required by safedeal
    //
    this.commands.push((game_self, gmv) => {
      if (gmv[0] === "DECKFLUSH") {
        let deckidx = parseInt(gmv[1]);
        if (gmv[2] == "discards") {
          this.game.deck[deckidx].discards = {};
        }
        this.game.queue.splice(qe, 1);
      }
      return 1;
    });

    this.commands.push((game_self, gmv) => {
      if (gmv[0] === "DECKENCRYPT") {
        let deckidx = parseInt(gmv[1]);
        let playerid = parseInt(gmv[2]);

        if (playerid != game_self.game.player) {
          return 0;
        }
        for (let i = 0; i < game_self.game.deck[deckidx - 1].crypt.length; i++) {
          game_self.game.deck[deckidx - 1].crypt[i] = game_self.app.crypto.decodeXOR(
            game_self.game.deck[deckidx - 1].crypt[i],
            game_self.game.deck[deckidx - 1].xor
          );
          game_self.game.deck[deckidx - 1].crypt[i] = game_self.app.crypto.encodeXOR(
            game_self.game.deck[deckidx - 1].crypt[i],
            game_self.game.deck[deckidx - 1].keys[i]
          );
        }

        game_self.game.turn = [];
        game_self.game.turn.push("RESOLVE");
        for (let i = 0; i < game_self.game.deck[deckidx - 1].crypt.length; i++) {
          game_self.game.turn.push(game_self.game.deck[deckidx - 1].crypt[i]);
        }

        game_self.game.turn.push(
          `CARDS\t${deckidx}\t${game_self.game.deck[deckidx - 1].crypt.length}`
        );

        let extra = {};
        game_self.sendMessage("game", extra);

        return 0;
      }
      return 1;
    });

    this.commands.push((game_self, gmv) => {
      if (gmv[0] === null || gmv[0] == "null") {
        game_self.game.queue.splice(game_self.game.queue.length - 1, 1);
      }
    });

    /////////////////
    // web3 crypto //
    /////////////////
    // supporting arbitrary third-party crypto modules -- specify receiving address
    //
    this.commands.push((game_self, gmv) => {
      if (gmv[0] === "CRYPTOKEY") {
        let playerkey = gmv[1];
        let cryptokey = gmv[2];
        let confsig = gmv[3];

        console.log("~~~~~~~~~~~~~~~~~~");
        console.log("RECEIVED CRYPTOKEY");
        console.log("~~~~~~~~~~~~~~~~~~");
        console.log(playerkey + " - " + cryptokey + " - " + confsig);
        console.log("~~~~~~~~~~~~~~~~~~");

        //
        // if the playerkey has signed this cryptokey, update
        //
        if (game_self.app.crypto.verifyMessage(cryptokey, confsig, playerkey)) {
          for (let i = 0; i < game_self.game.keys.length; i++) {
            if (game_self.game.players[i] === playerkey) {
              game_self.game.keys[i] = cryptokey;
            }
          }
        }

        game_self.game.queue.splice(game_self.game.queue.length - 1, 1);

        return 1;
      }
      return 1;
    });

    // share my game-available cryptos + balances
    this.commands.push((game_self, gmv) => {
      if (gmv[0] === "CRYPTOS") {
        let playerkey = gmv[1];
        let cryptos = gmv[2];

        console.log("~~~~~~~~~~~~~~~~~~");
        console.log("RECEIVED CRYPTOS");
        console.log("~~~~~~~~~~~~~~~~~~");
        //console.log(playerkey + " - " + [aarray of cryptos { ticker : "" , balance : "" });
        //console.log("~~~~~~~~~~~~~~~~~~");

	if (!this.game.cryptos) { this.game.cryptos = {}; }
	this.game.cryptos[playerkey] = cryptos;

        game_self.game.queue.splice(game_self.game.queue.length - 1, 1);

        return 1;
      }
      return 1;
    });

    //
    // supporting arbitrary third-party crypto modules
    //
    this.commands.push((game_self, gmv) => {
      if (gmv[0] === "SEND") {
        let sender = gmv[1];
        let receiver = gmv[2];
        let amount = gmv[3];
        let ts = gmv[4];
        let unique_hash = gmv[5];
        let ticker = game_self.game.crypto;
        if (gmv[6]) {
          ticker = gmv[6];
        }

        //
        // if we are not the sender, we do not need to worry and can continue
        //
        // note: senders identified by Saito publickey not other in this function
        //
        if (this.app.wallet.returnPublicKey() !== sender) {
          game_self.game.queue.splice(game_self.game.queue.length - 1, 1);
          return 1;
        }

        //
        // if we are the sender, lets get sending and receiving addresses
        //
        let sender_crypto_address = "";
        let receiver_crypto_address = "";
        for (let i = 0; i < game_self.game.players.length; i++) {
          if (game_self.game.players[i] === sender) {
            sender_crypto_address = game_self.game.keys[i];
          }
          if (game_self.game.players[i] === receiver) {
            receiver_crypto_address = game_self.game.keys[i];
          }
        }

        let my_specific_game_id = game_self.game.id;
        game_self.saveGame(game_self.game.id);
        game_self.game.halted = 1;

        //
        // permit users to opt-out of sanity checks
        //
        if (game_self.game.crypto_auto_settle == 1 || game_self.game.state?.crypto_auto_settle == 1) {
          game_self.app.wallet.sendPayment(
            [sender_crypto_address],
            [receiver_crypto_address],
            [amount],
            ts,
            unique_hash,
            function (robj) {
              if (game_self.game.id != my_specific_game_id) {
                game_self.game = game_self.loadGame(my_specific_game_id);
              }
              game_self.updateLog("payments issued...");
              game_self.game.queue.splice(game_self.game.queue.length - 1, 1);
              game_self.restartQueue();
              return 0;
            },
            ticker
          );
          return 0;

          //
          // by default we want users to approve any wallet-interactions
          //
        } else {

          game_self.crypto_transfer_manager.sendPayment(
            this.app,
            this,
            [sender_crypto_address.split("|")[0]],
            [receiver_crypto_address.split("|")[0]],
            [amount],
            ts,
            ticker,
            function () {
              game_self.app.wallet.sendPayment(
                [sender_crypto_address],
                [receiver_crypto_address],
                [amount],
                ts,
                unique_hash,
                function (robj) {
                  if (game_self.game.id != my_specific_game_id) {
                    game_self.game = game_self.loadGame(my_specific_game_id);
                  }
                  game_self.updateLog("payments issued...");
                  game_self.game.queue.splice(game_self.game.queue.length - 1, 1);
                  game_self.restartQueue();
                  return 0;
                },
                ticker
              );
              return 0;
            }
          );
        }
        return 0;
      }
      return 1;
    });

    this.commands.push((game_self, gmv) => {
      if (gmv[0] === "RECEIVE") {
        let sender = gmv[1];
        let receiver = gmv[2];
        let amount = gmv[3];
        let ts = gmv[4];
        let unique_hash = gmv[5];
        let ticker = game_self.game.crypto;
        if (gmv[6]) {
          ticker = gmv[6];
        }

        //
        // if we are not the receiver, we do not need to worry and can continue
        //
        // note: senders identified by Saito publickey not other in this function
        //
        if (this.app.wallet.returnPublicKey() !== receiver) {
          game_self.game.queue.splice(game_self.game.queue.length - 1, 1);
          return 1;
        }

        //
        // if we are the sender, lets get sending and receiving addresses
        //
        let sender_crypto_address = "";
        let receiver_crypto_address = "";
        for (let i = 0; i < game_self.game.players.length; i++) {
          if (game_self.game.players[i] === sender) {
            sender_crypto_address = game_self.game.keys[i];
          }
          if (game_self.game.players[i] === receiver) {
            receiver_crypto_address = game_self.game.keys[i];
          }
        }

        let my_specific_game_id = game_self.game.id;
        game_self.saveGame(game_self.game.id);
        game_self.game.halted = 1;

        //
        // we don't need to wait for confirmation if we've already indicated
        // we just want to move ahead. the game engine should not be biased
        // towards forcing a halt in game if people do not want that.
        //
        if (game_self.game_crypto_auto_settle == 1 || game_self.game.state?.crypto_auto_settle == 1) {
          game_self.game.queue.splice(game_self.game.queue.length - 1, 1);
          return 1;
        } else {
          game_self.crypto_transfer_manager.receivePayment(
            this.app,
            this,
            [sender_crypto_address.split("|")[0]],
            [receiver_crypto_address.split("|")[0]],
            [amount],
            ts,
            ticker,
            function (divname) {
              game_self.app.wallet.receivePayment(
                [sender_crypto_address],
                [receiver_crypto_address],
                [amount],
                ts,
                unique_hash,
                function (robj) {
                  if (document.querySelector(".spinner")) {
                    document.querySelector(".spinner").remove();
                  }
                  $(".game-crypto-transfer-manager-container .hidden").removeClass("hidden");
                  if (divname) {
                    if (robj) {
                      //==1, success
                      divname.textContent = "Success";
                    } else {
                      //==0, failure
                      divname.textContent = "Failed";
                    }
                  }
                  if (game_self.game.id != my_specific_game_id) {
                    game_self.game = game_self.loadGame(my_specific_game_id);
                  }
                  game_self.updateLog("payments received...");
                  game_self.game.queue.splice(game_self.game.queue.length - 1, 1);
                  game_self.restartQueue();
                  return 0;
                },
                ticker,
                -1
              );
              return 0;
            }
          );
          return 0;
        }
      }
      return 1;
    });

    //
    // provides a way for games to enable in-game crypto
    //
    // if i receive this, a player in the game is proposing a crypto-game
    // and i should respond in some capacty.
    //
    this.commands.push((game_self, gmv) => {
      if (gmv[0] === "STAKE") {
        let ticker = gmv[1];
        let stake = gmv[2];
        let ts = parseInt(gmv[3]);
        let sigs = JSON.parse(gmv[4]);
        let auths = 0;
        let first_non_verifier_idx = -1;

        //
        // players can update the timestamp to NOSTAKE to unequivocably reject
        // the request to switch to a staked game.
        //
        if (ts == "NOSTAKE") {
          game_self.game.queue.splice(game_self.game.queue.length - 1, 1);
          return 1;
        }

        //
        // otherwise, we check to see if all of the sigs exist and if they don't
        // we ask the players to authorize or reject one-by-one.
        //
        game_self.game.queue.splice(game_self.game.queue.length - 1, 1);

        try {
          for (let i = 0; i < game_self.game.players.length; i++) {
            let msg_to_verify = `${ts} ${ticker} ${stake} ${game_self.game.id}`;
            if (sigs[i] !== "") {
              if (
                game_self.app.crypto.verifyMessage(
                  msg_to_verify,
                  sigs[i],
                  game_self.game.players[i]
                ) === true
              ) {
                auths++;
              } else {
                if (first_non_verifier_idx == -1) {
                  first_non_verifier_idx = i;
                }
              }
            } else {
              first_non_verifier_idx = i;
            }
          }
        } catch (err) {
          console.log("err: " + err);
        }

        if (auths == game_self.game.players.length) {
          game_self.updateLog("Crypto Activated: " + stake + " " + ticker);
          game_self.decimal_precision = 8;
          game_self.game.options.crypto = ticker;
          game_self.game.options.stake = stake;
          game_self.game.crypto = ticker;
          game_self.game.stake = stake;
          // the game can initialize anything it needs
          game_self.initializeGameStake(ticker, stake);
        } else {
          if (game_self.game.player - 1 == first_non_verifier_idx) {
            //
            // auto-accept
            //
            game_self.crypto_transfer_manager.approveGameStake(
              this.app,
              this,
              ticker,
              stake,
              sigs,
              ts,
              function () { }
            );
          } else {
            this.updateStatus("Waiting for Others to Accept");
          }
          return 0;
        }
      }

      return 1;
    });

    this.commands.push((game_self, gmv) => {
      if (gmv[0] === "BALANCE") {
        let addresses = [];
        let amount = parseInt(gmv[1]);
        let address = gmv[2];
        let ticker = gmv[3];
	let report_address = address.substring(0, 14)+"...";

        addresses[0] = address;

        //
        // october 4th
        //
        game_self.saveGame(game_self.game.id);
        game_self.game.halted = 1;
        let my_specific_game_id = game_self.game.id;
try {
        siteMessage("checking player balance: " + report_address, 5000);
        game_self.updateStatus(report_address + " balance check");
        game_self.updateLog(report_address + " balance check");
} catch (err) {}
        let polling_timer = setTimeout(() => {
          game_self.updateStatus("Checking Balance: " + report_address);
          game_self.app.wallet.returnPreferredCryptoBalances(
            addresses,
            function (robj) {
              let balance_adequate = 0;

              for (let z = 0; z < robj.length; z++) {
                if (robj[z].address === address) {
                  if (robj[z].balance >= amount) {
                    balance_adequate = 1;
                    clearInterval(polling_timer);
                  }
                }
              }

              if (balance_adequate == 1) {
                if (game_self.game.id != my_specific_game_id) {
                  game_self.game = game_self.loadGame(my_specific_game_id);
                }

		try {
                  game_self.updateLog(report_address + " balance adequate");
                  game_self.updateStatus(report_address + " balance adequate");
		  siteMessage(report_address + " balance adequate...", 5000);
		} catch (err) {
		  console.log("ERROR 572934: " + err);
		}

                game_self.game.queue.splice(game_self.game.queue.length - 1, 1);
                game_self.restartQueue();
                return 0;
              }
            },
            ticker
          );
        }, 8000);

        return 0;
      }
      return 1;
    });
  }





  shuffleDeck(deckidx = 1) {
    let new_cards = [];
    let new_keys = [];

    let old_crypt = this.game.deck[deckidx - 1].crypt;
    let old_keys = this.game.deck[deckidx - 1].keys;

    let total_cards = this.game.deck[deckidx - 1].crypt.length;
    let total_cards_remaining = total_cards;

    for (let i = 0; i < total_cards; i++) {
      // will never have zero die roll, so we subtract by 1
      let random_card = this.rollDice(total_cards_remaining) - 1;

      new_cards.push(old_crypt[random_card]);
      new_keys.push(old_keys[random_card]);

      old_crypt.splice(random_card, 1);
      old_keys.splice(random_card, 1);

      total_cards_remaining--;
    }

    this.game.deck[deckidx - 1].crypt = new_cards;
    this.game.deck[deckidx - 1].keys = new_keys;
  }

  addPool() {
    let newIndex = this.game.pool.length;
    this.resetPool(newIndex);
  }
  addDeck() {
    let newIndex = this.game.deck.length;
    this.resetDeck(newIndex);
  }
  resetPool(newIndex = 0) {
    this.game.pool[newIndex] = {};
    this.game.pool[newIndex].cards = {};
    this.game.pool[newIndex].crypt = [];
    this.game.pool[newIndex].keys = [];
    this.game.pool[newIndex].hand = [];
    this.game.pool[newIndex].decrypted = 0;
  }
  resetDeck(newIndex = 0) {
    this.game.deck[newIndex] = {};
    this.game.deck[newIndex].cards = {};
    this.game.deck[newIndex].crypt = [];
    this.game.deck[newIndex].keys = [];
    this.game.deck[newIndex].hand = [];
    this.game.deck[newIndex].xor = "";
    this.game.deck[newIndex].discards = {};
    this.game.deck[newIndex].removed = {};
  }
  newDeck() {
    let deck = {};
    deck.cards = {};
    deck.crypt = [];
    deck.keys = [];
    deck.hand = [];
    deck.xor = "";
    deck.discards = {};
    deck.removed = {};
    return deck;
  }


}

module.exports = GameQueue;
