
module.exports = (app, mod, tx) => {
    
    let txmsg = tx.returnMessage();

    return `
        <div class="tweet tweet-notification notification-item-${tx.transaction.sig}" data-id="${tx.transaction.sig}">
          <div class="tweet-notice"></div>
          <div class="tweet-header"></div>
          <div class="tweet-body">
            <div class="tweet-sidebar"></div>
            <div class="tweet-main">
              <div class="notification-tweet" id="tweet-${tx.transaction.sig}">${txmsg.data.text}</div>
              <div class="tweet-preview"></div>
            </div>
          </div>
        </div>
    `;

}

