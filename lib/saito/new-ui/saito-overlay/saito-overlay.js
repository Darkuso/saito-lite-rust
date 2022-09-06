const SaitoOverlayTemplate = require("./saito-overlay.template");

/**
 * Generic class for creating an overlay (i.e. a popup box for information or interaction)
 * A callback can be associated with closing the overlay
 * By default, a close button is included
 */
class SaitoOverlay {
  /**
   * @constructor
   * @param app - the Saito Application
   * @param withCloseBox - a flag (default = true) to have a close button in the corner of the overlay
   */
  constructor(app, withCloseBox = true) {
    this.app = app;
    this.ordinal = "";
    this.closebox = withCloseBox;
  }

  /**
   * Create the DOM elements if they don't exist. Called by show
   * @param app - the Saito Application
   * @param mod - the calling module
   */
  render(app, mod) {
    if (this.ordinal === "") {
      if (document.querySelector(".saito-overlay-backdrop")) {
	for (let i = 1; i < 100; i++) {
	  let qs = `.saito-overlay-backdrop${i}`;
	  if (!document.querySelector(qs)) {
	    this.ordinal = i;
	    break;
	  }
	}
      }
    }
    let qs = `.saito-overlay-backdrop${this.ordinal}`;
    if (!document.querySelector(qs)) {
      this.app.browser.addElementToDom(SaitoOverlayTemplate(this.ordinal));
    }
  }

  /**
   * Does nothing
   * @param app - the Saito Application
   * @param mod - the calling module
   */
  attachEvents(app, mod) {}

  /**
   * Renders the Overlay with the given html and attaches events to close it
   * @param app - the Saito application
   * @param mod - the calling module
   * @param html - the content for the overlay
   * @param mycallback - a function to run when the user closes the overlay
   *
   */
  show(app, mod, html, mycallback = null) {

    this.render(app, mod);

    let overlay_self = this;

    let elsq = `.saito-overlay${this.ordinal}`;
    let bdelsq = `.saito-overlay-backdrop${this.ordinal}`;

    let overlay_el = document.querySelector(elsq);
    let overlay_backdrop_el = document.querySelector(bdelsq);

    try {
      overlay_el.style.display = "block";
      overlay_backdrop_el.style.display = "block";

      if (this.closebox) {
        overlay_el.innerHTML =
          `<div id="saito-overlay-closebox${this.ordinal}" class="saito-overlay-closebox saito-overlay-closebox${this.ordinal}"><i class="fas fa-times-circle saito-overlay-closebox-btn"></i></div>` +
          html;
        //Close by clicking on closebox
        let closebox_qs = `#saito-overlay-closebox${this.ordinal}`;
        let closebox_el = document.querySelector(closebox_qs);
        closebox_el.onclick = (e) => {
          overlay_self.hide(mycallback);
        };
      } else {
        overlay_el.innerHTML = html;
      }

      overlay_backdrop_el.onclick = (e) => {
        overlay_self.hide(mycallback);
      };
    } catch (err) {
      console.error("OVERLAY ERROR:", err);
    }
  }

  /**
   * Hide all the overlay elements from view
   * @param mycallback - a function to run on completion
   */
  hide(mycallback = null) {

    let elsq = `.saito-overlay${this.ordinal}`;
    let bdelsq = `.saito-overlay-backdrop${this.ordinal}`;

    let overlay_el = document.querySelector(elsq);
    let overlay_backdrop_el = document.querySelector(bdelsq);

    if (overlay_el) {
      overlay_el.style.display = "none";
    }
    if (overlay_backdrop_el) {
      overlay_backdrop_el.style.display = "none";
    }

    if (mycallback != null) {
      mycallback();
    }
  }



  //
  // The following functions are ported over from the old GameOverlay to retain
  // backwards compatibility of code written for that component. We should eventually
  // purge these from the main UI component or push them down to sub-components in 
  // the games which inherit from the main overlay class and add this functionality.
  //
  /**
   * Backwards compatible show function
   * @param app - the Saito application
   * @param mod - the calling module
   * @param html - the content for the overlay
   * @param mycallback - a function to run when the user closes the overlay
   *
   */
  showOverlay(app, mod, html, mycallback = null) {
    this.show(app, mod, html, mycallback);
  }

  /**
   * Backwards compatible hide functino
   * @param mycallback - a function to run on completion
   */
  hideOverlay(mycallback = null) {
    this.hide();
  }



  /**
   * Turn off event listerner for clicking outside overlay to close it
   */
  blockClose() {
    let qs = `.saito-overlay-backdrop${this.ordinal}`;
    let overlay_backdrop_el = document.querySelector(qs);
    if (overlay_backdrop_el) {
      overlay_backdrop_el.onclick = (e) => {};
    }
  }

  /**
   * Delete inner html of overlay (regardless of whether it is shown or hidden)
   */
  clear(){
    try {
      let qs = `.saito-overlay${this.ordinal}`;
      let overlay_el = document.querySelector(qs);
      if (overlay_el){
        if (this.closebox) {
          overlay_el.innerHTML = `<div id="saito-overlay-closebox" class="saito-overlay-closebox"><i class="fas fa-times-circle saito-overlay-closebox-btn"></i></div>`;
        }else{
          overlay_el.innerHTML = "";
        }
      }
    }catch(err){
     console.error(err);
    }
  }

  /**
   * TODO -- improve this module
   *
   * A specific function for Twilight that allows for more advanced display formatting through parameters
   * options:
   *      columns
   *      backgroundImage
   *      title
   *      subtitle
   *      padding
   *      textAlign
   *
   *      cardListWidth
   *      cardListHeight
   *      unselectableCards
   *      onContinue
   *      onClose
   *
   *    -- DEPRECATED -- rowGap, columnGap
   */
  showCardSelectionOverlay(app, game_mod, cards, options = {}) {
    //Get Styling Options
    let wrapper_style = options.padding ? `padding:${options.padding};` : "";
    wrapper_style += options.backgroundImage
      ? `background-image: url(${options.backgroundImage}); background-size: cover;`
      : "background-color: #111D;";
    wrapper_style += options.textAlign ? `text-align:${options.textAlign};` : "";

    //Start building HTML
    let html = `<div style="${wrapper_style}">`;

    if (options.title) {
      html += `<div class="game-overlay-cardlist-title">${options.title}</div>`;
    }
    if (options.subtitle) {
      html += `<div class="game-overlay-cardlist-subtitle">${options.subtitle}</div>`;
    }

    let unselectable_cards = options.unselectableCards ? options.unselectableCards : [];

    html += '<div class="game-overlay-cardlist-container">';
    for (let i in cards) {
      let thishtml = '<div class="game-overlay-cardlist-card">';
      if (cards[i] != undefined) {
        let x = 0;
        if (typeof cards[i] === "object" && !Array.isArray(cards[i]) && cards[i] != null) {
          if (cards[i].returnCardImage != "undefined" && cards[i].returnCardImage != null) {
            thishtml += cards[i].returnCardImage();
            x = 1;
          }
        }
        if (x == 0) {
          if (Array.isArray(cards)) {
            thishtml += game_mod.returnCardImage(cards[i]);
          } else {
            thishtml += game_mod.returnCardImage(i);
          }
        }
      } else {
        thishtml += game_mod.returnCardImage(i);
      }
      thishtml += "</div>";

      //
      // is this unselectable?
      //
      for (let p = 0; p < unselectable_cards.length; p++) {
        if (JSON.stringify(unselectable_cards[p]) === JSON.stringify(cards[i])) {
          thishtml = thishtml.replace(
            /game-overlay-cardlist-card/g,
            "game-overlay-cardlist-card game-overlay-cardlist-unselectable"
          );
        }
      }

      html += thishtml;
    }
    html += "</div>"; //close .game-overlay-cardlist-container

    //Check options for buttons
    let has_continue_button = 1;
    let has_close_button = 1;
    if (!options.onClose) {
      options.onClose = function () {};
      has_close_button = 0;
    }
    if (!options.onContinue) {
      options.onContinue = function () {};
      has_continue_button = 0;
    }

    if (has_continue_button || has_close_button) {
      html += '<div class="game-overlay-button-container">';
      if (has_continue_button) {
        html += `<div class="game-overlay-button-continue button game-overlay-cardlist-button">continue</div>`;
      }
      if (has_close_button) {
        html += `<div class="game-overlay-button-close button super game-overlay-cardlist-button">close</div>`;
      }
      html += "</div>";
    }

    html += "</div>"; //close wrapper div

    //Show Overlay
    this.show(app, game_mod, html, options.onClose);


    // set min height of cardlist card elements
    //
    document.querySelectorAll(".game-overlay-cardlist-card").forEach((el) => {
      if (el.children) {
        el.style.height = this.calculateElementHeight(el.children[0]);
      }
    });

    //
    // set width/height
    //
    let cardlist_container_height = options.cardlistHeight || "80vh";
    let cardlist_container_width = options.cardlistWidth || "80vw";

    document.querySelector(".game-overlay-cardlist-container").style.width =
      cardlist_container_width;
    document.querySelector(".game-overlay-cardlist-container").style.height = "auto";
    document.querySelector(".game-overlay-cardlist-container").style.maxWidth =
      cardlist_container_width;
    document.querySelector(".game-overlay-cardlist-container").style.maxHeight =
      cardlist_container_height;

    //
    // right-align left card if only 2
    //
    if (cards.length == 2) {
      let el = document.querySelector(".game-overlay-cardlist-container");
      if (el) {
        el.style.justifyItems = "unset";
        let el2 = el.children[0];
        if (el2) {
          let el3 = el2.children[0];
          if (el3) {
            el3.style.float = "right";
          }
        }
      }
    } else {
      let el = document.querySelector(".game-overlay-cardlist-container");
      if (el) {
        el.style.justifyItems = "center";
      }
    }

    //
    // center single card
    //
    if (cards.length == 1) {
      let el = document.querySelector(".game-overlay-cardlist-card");
      el.style.marginRight = "auto";
      el.style.marginLeft = "auto";
    }


    // Apply Functionality to the buttons
    //
    if (has_continue_button) {
      document.querySelector(".game-overlay-button-continue").onclick = (e) => {
        options.onContinue();
      };
    }
    if (has_close_button) {
      document.querySelector(".game-overlay-button-close").onclick = (e) => {
        options.onClose();
      };
    }

    //
    // if cards are selectable
    //
    if (options.onCardSelect) {
      document.querySelectorAll(".game-overlay-cardlist-card").forEach((el) => {
        el.onclick = (e) => {
          let cardname = el.getAttribute("id");
          if (cardname == null) {
            if (el.children) {
              cardname = el.children[0].getAttribute("id");
            }
          }
          options.onCardSelect(cardname);
        };
      });

      document.querySelectorAll(".game-overlay-cardlist-unselectable").forEach((el) => {
        el.onclick = (e) => {};
      });
    }

    // update number shown
    if (options.columns > 0) {
      let x = "1fr ";
      for (let y = 1; y < options.columns; y++) {
        x += "1fr ";
      }
      document.querySelector(".game-overlay-cardlist-container").style.gridTemplateColumns = x;
    } else {
      document.querySelector(".game-overlay-cardlist-container").style.gridTemplateColumns =
        "1fr 1fr 1fr 1fr";
    }
  }


  /**
   * copy of gamehud function needed for showCardSelectionOverlay
   *
   */
  calculateElementHeight(elm) {
    if (document.all) {
      // IE
      elmHeight = elm.currentStyle.height;
      elmMargin =
        parseInt(elm.currentStyle.marginTop, 10) + parseInt(elm.currentStyle.marginBottom, 10);
    } else {
      // Mozilla
      elmHeight = document.defaultView.getComputedStyle(elm, "").getPropertyValue("height");
      elmMargin =
        parseInt(document.defaultView.getComputedStyle(elm, "").getPropertyValue("margin-top")) +
        parseInt(document.defaultView.getComputedStyle(elm, "").getPropertyValue("margin-bottom"));
    }
    return parseInt(elmHeight) + parseInt(elmMargin) + "px";
  }

}

module.exports = SaitoOverlay;
