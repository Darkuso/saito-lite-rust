/* 

This module requires a gifphy API key to be set as an environmental variable:
GIPHY_KEY

Modules must provide an input id to attach the gif selector to.

Modules can also provide a callback to determine how the image (url) is processed.

*/
const ModTemplate = require("../../lib/templates/modtemplate");
const { GiphyFetch } = require("@giphy/js-fetch-api");
const { renderGif, renderGrid } = require("@giphy/js-components");
const SaitoOverlay = require("./../../lib/saito/ui/saito-overlay/saito-overlay");
const saitoGifTemplate = require("./lib/giphy.template");

/*
    I'm not sure this is really working with the giphy library stuff... 
    Certainly don't see it pop up when waiting for the giphy server response
*/
//const SaitoLoader = require("./../../lib/saito/ui/saito-loader/saito-loader");

class Giphy extends ModTemplate {
  constructor(app, mod, parent_callback = null) {
    super(app);
    this.app = app;
    this.mod = mod;
    this.name = "Giphy";

    this.parent_callback = parent_callback;
    this.overlay = new SaitoOverlay(app, mod);
    //this.loader = new SaitoLoader(app, mod);
    this.auth = null;
    this.gf = null;

    this.styles = ["/giphy/style.css"];

    this.initialize(app);
  }

  initialize(app) {
    super.initialize(app);
  }

  returnServices() {
    let services = [];
    if (this.app.BROWSER == 0) {
      services.push({ service: "giphy" });
    }
    return services;
  }

  onPeerServiceUp(app, peer, service = {}) {
    let gif_self = this;

    if (service.service === "giphy") {
      app.network.sendRequestAsTransactionWithCallback("get giphy auth", {}, function (res) {
        gif_self.auth = res;
      });
    }
  }

  respondTo(type, obj = null) {
    let giphy_self = this;
    if (type === "giphy") {
      this.attachStyleSheets();
      return {
        renderInto: (container, callback) => {
          giphy_self.container = container;
          giphy_self.parent_callback = callback;
          giphy_self.render();
          giphy_self.attachEvents();
        },
      };
    }

    return super.respondTo(type, obj);
  }

  ////////
  //Wait, is this even used????
  ////////
  toDataURL = (url) =>
    fetch(url)
      .then((response) => response.blob())
      .then(
        (blob) =>
          new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          })
      );

  render() {
    let giphy_self = this;

    //
    //Calculate reasonable sizing of results 
    //
    this.selectorWidth = window.innerWidth;
    if (this.container) {
      let container = document.querySelector(this.container);
      if (container) {
        this.selectorWidth = container.getBoundingClientRect().width;
      }
    }

    this.selectorColumns = 3;

    if (this.selectorWidth > 525) {
      this.selectorWidth = 500 + (this.selectorWidth - 500) / 2;
    }
    if (this.selectorWidth > 750) {
      this.selectorWidth = 750;
    }
    this.selectorColumns = Math.floor(this.selectorWidth / 150);

    //
    // Initiate the Giphy search service
    //
    if (!this.gf || this.gf.apiKey === null) {
      this.gf = new GiphyFetch(this.auth);
    }


    if (this.container) {
        if (!document.querySelector(".saito-gif-container")){
            this.app.browser.addElementToSelector(saitoGifTemplate(this.app, this.mod), this.container);      
        }
    } else {
      this.overlay.show(saitoGifTemplate(this.app, this.mod));
    }

    //this.loader.render(this.app, this.mod, "saito-gif-content");
    let onGifClick = (gif, e) => {
      e.preventDefault();
      this.parent_callback(gif.images.original.url);
      this.overlay.remove();
    };

    renderGrid(
      {
        width: giphy_self.selectorWidth,
        fetchGifs: (offset) => {
            //giphy_self.loader.remove();
          return this.gf.search("inception", { offset });
        },
        columns: giphy_self.selectorColumns,
        gutter: 2,
        onGifClick,
        key: 34,
      },
      document.querySelector(".saito-gif-content")
    );

  }

  attachEvents(){
    let giphy_self = this;
    let gif_search_icon = document.querySelector(".saito-gif-search i");
    let gif_input_search = document.querySelector(".saito-gif-search input");

    gif_search_icon.onclick = () => {
      let value = gif_input_search.value;
      console.log(gif_input_search.value, "value");
      document.querySelector(".saito-gif-content").innerHTML = "";
      //this.loader.render(this.app, this.mod, "saito-gif-content");

      let onGifClick = (gif, e) => {
        e.preventDefault();
        this.parent_callback(gif.images.original.url);
        this.overlay.remove();
      };

      renderGrid(
        {
          width: giphy_self.selectorWidth,
          fetchGifs: (offset) => {
            //giphy_self.loader.remove();
            //console.log("offset", offset, "value ", value);
            return this.gf.search(value, { offset });
          },
          columns: giphy_self.selectorColumns,
          gutter: 2,
          onGifClick,
          key: value,
        },
        document.querySelector(".saito-gif-content")
      );
      
    };

  }

  async handlePeerTransaction(app, tx = null, peer, mycallback) {
    if (tx == null) {
      return;
    }
    let message = tx.returnMessage();
    if (message.request === "get giphy auth") {
      let api_key = "";
      try {
        api_key = process.env.GIPHY_KEY;
        if (mycallback) {
          mycallback(api_key);
        }
      } catch (err) {
        console.log("Failed to find key with error: " + err);
      }
    }
  }
}

module.exports = Giphy;
