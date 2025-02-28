const SaitoUser = require("./../../../lib/saito/ui/saito-user/saito-user");
const PostTemplate = require("./post.template");
const SaitoOverlay = require("./../../../lib/saito/ui/saito-overlay/saito-overlay");
const SaitoInput = require("./../../../lib/saito/ui/saito-input/saito-input");
const JSON = require("json-bigint");

class Post {
  constructor(app, mod, tweet = null) {
    this.app = app;
    this.mod = mod;
    this.overlay = new SaitoOverlay(this.app, this.mod, true, true);
    this.parent_id = "";
    this.thread_id = "";
    this.images = [];
    this.tweet = tweet; //For reply or Retweet

    this.render_after_submit = 0;
    this.file_event_added = false;
    this.publickey = app.wallet.returnPublicKey();
    this.source = "Tweet";

    this.user = new SaitoUser(
      this.app,
      this.mod,
      `.tweet-overlay-header`,
      this.publickey,
      "create a text-tweet or drag-and-drop images..."
    );
  }

  render() {
    this.overlay.show(PostTemplate(this.app, this.mod, this));
    this.overlay.blockClose();

    //
    //
    //

    if (!this.input) {
      this.input = new SaitoInput(this.app, this.mod, ".tweet-overlay-content");
    }

    this.input.display = "large";

    this.input.placeholder = "What's happening";
    if (this.source == "Retweet") {
      this.input.placeholder = "optional comment";
      this.user.notice = "add a comment to your retweet or just click submit...";
    }

    if (this.source == "Reply") {
      this.input.placeholder = "my reply...";
      this.user.notice = "add your comment to the tweet...";
    }

    this.input.callbackOnReturn = () => {
      this.postTweet();
    };
    this.input.callbackOnUpload = async (file) => {
      if (this.images.length >= 4) {
        salert("Maximum 4 images allowed per tweet.");
      } else if (file.includes("giphy.gif")) {
        this.addImg(file);
      } else {
        let type = file.substring(file.indexOf(":") + 1, file.indexOf(";"));
        if (this.mod.allowed_upload_types.includes(type)) {
          let resized_img = await this.app.browser.resizeImg(file);
          this.addImg(resized_img);
        } else {
          salert(`Cannot upload ${type} image, allowed file types: 
              ${this.mod.allowed_upload_types.join(", ")} 
              - this issue can be caused by image files missing common file-extensions. In this case try clicking on the image upload button and manually uploading.`);
        }
      }
    };

    this.user.render();

    this.input.render();

    this.attachEvents();
  }

  triggerClick(querySelector) {
    //console.log(querySelector);
    //console.log(document.querySelector(querySelector));
    if (document.querySelector(querySelector)) {
      document.querySelector(querySelector).click();
    }
  }

  attachEvents() {
    let post_self = this;
    post_self.images = [];

    if (post_self.file_event_added == false) {
      post_self.app.browser.addDragAndDropFileUploadToElement(
        "tweet-overlay",
        async (file) => {
          if (post_self.images.length >= 4) {
            salert("Maximum 4 images allowed per tweet.");
          } else {
            let type = file.substring(file.indexOf(":") + 1, file.indexOf(";"));
            if (post_self.mod.allowed_upload_types.includes(type)) {
              let resized_img = await this.app.browser.resizeImg(file);
              this.addImg(resized_img);
            } else {
              salert(
                "allowed file types: " +
                  post_self.mod.allowed_upload_types.join(", ") +
                  " - this issue can be caused by image files missing common file-extensions. In this case try clicking on the image upload button and manually uploading."
              );
            }
          }
          post_self.file_event_added = true;
        },
        false
      );
    }

    if (
      typeof document.querySelector(".my-form") != "undefined" &&
      document.querySelector(".my-form")
    ) {
      document.querySelector(".my-form").style.display = "none";
    }

    document.querySelector(".post-tweet-textarea").addEventListener("keydown", (e) => {
      if (e.keyCode === 13 && e.ctrlKey) {
        document.getElementById("post-tweet-button").click();
        e.preventDefault();
      }
    });

    document.getElementById("post-tweet-button").addEventListener("click", (e) => {
      this.postTweet();
    });
  }

  postTweet() {
    let post_self = this;
    let text = document.getElementById("post-tweet-textarea").value;
    let parent_id = document.getElementById("parent_id").value;
    let thread_id = document.getElementById("thread_id").value;
    let source = document.getElementById("source").value;
    let keys = [];
    let identifiers = [];

    //don't send empty posts
    if (post_self.images.length == 0 && text.trim().length == 0 && post_self.source != "Retweet") {
      siteMessage("Post Empty", 1000);
      return;
    }

    //
    // extract keys from text AND then tweet
    //
    keys = post_self.app.browser.extractKeys(text);
    identifiers = post_self.app.browser.extractIdentifiers(text);

    //
    // add identifiers as available
    //
    for (let i = 0; i < identifiers.length; i++) {
      let key = this.app.keychain.returnPublicKeyByIdentifier(identifiers[i]);
      if (key) {
        if (!keys.includes(key)) {
          keys.push(key);
        }
      }
    }

    //
    // any previous recipients get added to "to"
    //
    if (post_self?.tweet?.tx?.transaction) {
      for (let i = 0; i < post_self.tweet.tx.transaction.to.length; i++) {
        if (!keys.includes(post_self.tweet.tx.transaction.to[i].add)) {
          keys.push(post_self.tweet.tx.transaction.to[i].add);
        }
      }
    }

    //
    // saito-loader
    //
    post_self.overlay.hide();
    post_self.overlay.closebox = false;
    post_self.overlay.show('<div class="saito-loader"></div>');

    //
    // tweet data
    //
    let data = { text: text };

    //Replies
    if (parent_id !== "") {
      data = { text: text, parent_id: parent_id, thread_id: thread_id, sig: parent_id };
    }
    //Retweets
    if (source == "Retweet") {
      data.retweet_tx = post_self.tweet.tx.serialize_to_web(this.app);
      data.sig = post_self.tweet.tx.transaction.sig;
    }

    if (post_self.images.length > 0) {
      data["images"] = post_self.images;
    }

    let newtx = post_self.mod.sendTweetTransaction(post_self.app, post_self.mod, data, keys);

    //
    // This makes no sense. If you require at the top of the file, it fails with a
    // new Tweet is not a constructor error!!! ???
    //
    const Tweet = require("./tweet");
    let posted_tweet = new Tweet(post_self.app, post_self.mod, newtx);
    //console.log("New tweet:" , posted_tweet);

    let rparent = this.tweet;
    if (rparent) {
      //console.log(rparent)

      //
      // loop to remove anything we will hide
      //
      let rparent2 = rparent;
      while (this.mod.returnTweet(rparent2.parent_id)) {
        let x = this.mod.returnTweet(rparent2.parent_id);
        let qs = ".tweet-" + x.tx.transaction.sig;
        if (document.querySelector(qs)) {
          //console.log(qs);
          document.querySelector(qs).remove();
        }
        rparent2 = x;
      }


      if (posted_tweet.retweet_tx) {
        rparent.tx.optional.num_retweets++;
        rparent.num_retweets++;
        rparent.render();
      } else {
        rparent.addTweet(posted_tweet);
        rparent.critical_child = posted_tweet;
        rparent.tx.optional.num_replies++;
        rparent.num_replies++;
        rparent.renderWithCriticalChild();
      }

    } else {
      this.mod.addTweet(posted_tweet.tx, true);
      posted_tweet.render(true);
    }

    //We let the loader run for a half second to show we are sending the tweet
    setTimeout(() => {
      post_self.overlay.remove();
    }, 800);
  }

  addImg(img) {
    post_self = this;
    this.app.browser.addElementToDom(
      `<div class="post-tweet-img-preview"><img src="${img}"
           /><i data-id="${
             this.images.length - 1
           }" class="fas fa-times-circle saito-overlay-closebox-btn post-tweet-img-preview-close"></i>
           </div>`,
      document.getElementById("post-tweet-img-preview-container")
    );
    this.images.push(img);

    // attach img preview event
    // event added here because img-prievew is added dynamically
    let sel = ".post-tweet-img-preview-close";
    document.querySelectorAll(sel).forEach((elem) => {
      elem.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopImmediatePropagation();

        let array_position = e.target.getAttribute("data-id");
        e.target.parentNode.remove();
        post_self.images.splice(array_position, 1);
        document.querySelectorAll(".post-tweet-img-preview-close").forEach((el2) => {
          let array_position2 = el2.getAttribute("data-id");
          if (array_position2 > array_position) {
            el2.setAttribute("data-id", array_position2 - 1);
          }
        });
      });
    });
  }
}

module.exports = Post;
