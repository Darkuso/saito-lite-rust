const InvitationLinkTemplate = require('./invitation-link.template');
const SaitoOverlay = require("./../../saito-overlay/saito-overlay");

class InvitationLink {

    constructor(app, mod){
        this.overlay = new SaitoOverlay(app);
        this.app = app;
        this.mod = mod;
    }
    
    render(app, mod, data = {}) {
        this.overlay.show(app, mod, InvitationLinkTemplate(app, mod, data));
        this.attachEvents(app, mod);
    }

    attachEvents(app, mod) {
        try{
            document.querySelector('#copy-invite-link').addEventListener('click', (e) => {
                navigator.clipboard.writeText(e.currentTarget.dataset.link);
                salert("Copied to clipboard!");
                this.overlay.remove();
            });
        }catch(err){
            console.error(err);
        }
    }
}


module.exports = InvitationLink;
