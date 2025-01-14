const InvitationLinkTemplate = require('./saito-link.template');
const SaitoOverlay = require("./../../saito-overlay/saito-overlay");

class InvitationLink {

    constructor(app, mod, data={}){
        this.data = data; 
        this.overlay = new SaitoOverlay(app, mod);
        this.invite_link = "";
    }
    
    render() {
        this.buildLink();
        this.overlay.show(InvitationLinkTemplate(this.data));
        this.attachEvents();
    }

    attachEvents(){
        try{
            document.querySelector('#copy-invite-link').addEventListener('click', (e) => {
                navigator.clipboard.writeText(this.invite_link);
                this.overlay.remove();
            });
        }catch(err){
            console.error(err);
        }
    }


    buildLink(){
        this.invite_link = window.location.origin;
        let path = this.data?.path || window.location.pathname;

        this.invite_link += path ;

        //Make sure we have the final /
        if (this.invite_link.slice(-1) != "/") {
            this.invite_link += "/";
        }

        for (let key in this.data){
            if (key !== "path" && key !== "name"){
                this.invite_link += "&" + key + "=" + this.data[key];
            }
        }

        this.invite_link = this.invite_link.replace("/&", "/?");

        console.log(this.invite_link);
    }

}


module.exports = InvitationLink;
