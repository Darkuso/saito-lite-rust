const UploadRomOverlayTemplate = require("./upload-rom.template");
const SaitoOverlay = require("./../../../lib/saito/new-ui/saito-overlay/saito-overlay");


class UploadRomOverlay {

  constructor(app, mod = null, selector = "") {
    this.app = app;
    this.mod = mod;
    this.overlay = new SaitoOverlay(app);
  }

  render(app, mod, selector = "") {
    this.overlay.show(app, mod, UploadRomOverlayTemplate(app, mod));
    this.attachEvents(app, mod);
  }

  attachEvents(app, mod) {

    let uploader = this;    

    try {

      // upload rom file 
      app.browser.addDragAndDropFileUploadToElement("nwasm-upload-overlay",
        (file) => {

          document.querySelector('.loader').style.display = "grid";
 
	  mod.active_rom = file;

	  let a = Buffer.from(file, 'binary').toString('base64');;
	  let ab = mod.convertBase64ToByteArray(a);

	  //
	  // initialize ROM gets the ROM the APP and the MOD
	  //
	  myApp.initializeRom(ab, app, mod);
	  mod.hideSplashScreen();
	  mod.hideLibrary();
	  uploader.overlay.hide();

        },
      false, true); // true = read as array buffer


    } catch(err) {
      console.log('ROM file upload error: '+err);
    }

  }

}


module.exports = UploadRomOverlay;

