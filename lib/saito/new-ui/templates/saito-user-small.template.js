
module.exports = SaitoUserTemplate = (app, mod, publickey = "", userline = "") => {

  let imgsrc = '/saito/img/no-profile.png';

  if (app.crypto.isPublicKey(publickey)) {
    imgsrc = app.keys.returnIdenticon(publickey);
  }

  return `
    <div class="saito-user small saito-user-${publickey}" id="saito-user-${publickey}" data-id="${publickey}">
      <div class="saito-identicon-box"><img class="saito-identicon small" src="${imgsrc}" data-id="${publickey}"></div>
      <div class="saito-username" data-id="${publickey}">${publickey}</div>
      <div class="saito-userline" data-id="${publickey}">${userline}</div>
    </div>
  `;

}
